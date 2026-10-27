import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const ids = {
  member: "00000000-0000-0000-0000-000000000001",
  other: "00000000-0000-0000-0000-000000000002",
  officer: "00000000-0000-0000-0000-000000000003",
  admin: "00000000-0000-0000-0000-000000000004",
  unverified: "00000000-0000-0000-0000-000000000005",
};

for (const legacy of [false, true]) {
  describe(legacy ? "Wydarzenia: aktualizacja starego schematu" : "Wydarzenia: aktualizacja minimalnej bazy", () => {
    let db: PGlite;
    let eventId: string;
    async function asUser(id: string) {
      await db.exec("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
    }
    async function rejected(sql: string, values: unknown[] = []) {
      await db.exec("savepoint rejection");
      await assert.rejects(db.query(sql, values));
      await db.exec("rollback to savepoint rejection; release savepoint rejection");
    }
    async function signup(role: string, id = eventId) {
      await db.query("select public.save_event_rsvp($1, $2::public.combat_role)", [id, role]);
    }
    before(async () => {
      db = new PGlite();
      await db.exec(`
        create role anon nologin;
        create role authenticated nologin;
        create schema auth;
        create table auth.users(id uuid primary key, email_confirmed_at timestamptz);
        create function auth.uid() returns uuid language sql stable as $$
          select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
        $$;
        grant usage on schema auth, public to anon, authenticated;
        grant execute on function auth.uid() to anon, authenticated;
      `);
      if (legacy) await db.exec(await readFile(new URL("../supabase/migrations/202610270001_initial_schema.sql", import.meta.url), "utf8"));
      await db.exec(await readFile(new URL("../supabase/migrations/202610270002_optional_profiles.sql", import.meta.url), "utf8"));
      for (const [name, id] of Object.entries(ids)) {
        await db.query("insert into auth.users values ($1, $2)", [id, name === "unverified" ? null : "2026-01-01T00:00:00Z"]);
      }
      if (legacy) {
        await db.query("update public.profiles set guild_role = 'officer' where id = $1", [ids.officer]);
        await db.query(`insert into public.events(title, event_type, starts_at, ends_at, created_by)
          values ('Zachowane wydarzenie', 'raid', now() + interval '1 day', now() + interval '2 days', $1)`, [ids.officer]);
      }
      await db.exec(await readFile(new URL("../supabase/migrations/202610270003_pvp_events.sql", import.meta.url), "utf8"));
      await db.query("update public.profiles set guild_role = 'officer' where id = $1", [ids.officer]);
      await db.query("update public.profiles set guild_role = 'admin' where id = $1", [ids.admin]);
      const event = await db.query<{ id: string }>(`insert into public.events(title, event_type, starts_at, ends_at, created_by, healers_needed, dps_needed)
        values ('Premade BG', 'battleground', now() + interval '1 day', now() + interval '2 days', $1, 1, 2) returning id`, [ids.officer]);
      eventId = event.rows[0].id;
    });
    after(async () => { await db?.close(); });
    beforeEach(async () => { await db.exec("begin"); });
    afterEach(async () => { await db.exec("rollback"); });

    it("tylko oficer i administrator mogą planować wydarzenia", async () => {
      const sql = `insert into public.events(title, event_type, starts_at, ends_at, dps_needed)
        values ('Arena wieczorem', 'pvp', now() + interval '1 day', now() + interval '2 days', 2) returning id`;
      await asUser(ids.member);
      await rejected(sql);
      assert.equal((await db.query<{ allowed: boolean }>("select public.is_guild_officer() as allowed")).rows[0].allowed, false);
      for (const id of [ids.officer, ids.admin]) {
        await asUser(id);
        assert.equal((await db.query(sql)).rows.length, 1);
        assert.equal((await db.query<{ allowed: boolean }>("select public.is_guild_officer() as allowed")).rows[0].allowed, true);
      }
    });
    it("nie pozwala promować siebie ani zmieniać autora wydarzenia", async () => {
      await asUser(ids.member);
      await rejected("update public.profiles set guild_role = 'officer' where id = auth.uid()");
      await asUser(ids.officer);
      await rejected("update public.events set created_by = $1 where id = $2", [ids.member, eventId]);
      await rejected(`insert into public.events(title, event_type, starts_at, ends_at, created_by)
        values ('Fałszywy autor', 'raid', now() + interval '1 day', now() + interval '2 days', $1)`, [ids.member]);
    });
    it("blokuje dostęp anonimowy oraz niepotwierdzone konta", async () => {
      await db.exec("set local role anon");
      for (const sql of ["select * from public.events", "select * from public.event_rsvps", "select public.is_guild_officer()"]) await rejected(sql);
      await rejected("select public.save_event_rsvp($1, 'dps')", [eventId]);
      await asUser(ids.unverified);
      assert.equal((await db.query("select * from public.events")).rows.length, 0);
      assert.equal((await db.query("select * from public.event_rsvps")).rows.length, 0);
      await rejected("select public.save_event_rsvp($1, 'dps')", [eventId]);
    });
    it("pozwala zapisać się z pustym profilem i zmienić rolę bez duplikatów", async () => {
      await asUser(ids.member);
      await signup("healer");
      await signup("dps");
      await signup("dps");
      const result = await db.query<{ role: string; profile_id: string }>("select role, profile_id from public.event_rsvps where event_id = $1", [eventId]);
      assert.deepEqual(result.rows, [{ role: "dps", profile_id: ids.member }]);
      const profile = await db.query<{ character_name: null }>("select character_name from public.profiles where id = auth.uid()");
      assert.equal(profile.rows[0].character_name, null);
    });
    it("wymaga roli i nie pozwala zapisywać innej osoby", async () => {
      await asUser(ids.member);
      await rejected("select public.save_event_rsvp($1, null)", [eventId]);
      await rejected("select public.save_event_rsvp($1, 'unknown')", [eventId]);
      await rejected("insert into public.event_rsvps(event_id, profile_id, role) values ($1, $2, 'dps')", [eventId, ids.other]);
      await signup("tank");
      await rejected("update public.event_rsvps set event_id = gen_random_uuid() where profile_id = auth.uid()");
      await rejected("update public.event_rsvps set profile_id = $1 where profile_id = auth.uid()", [ids.other]);
    });
    it("nie pozwala wycofać ani zmienić cudzego zapisu, również oficerowi", async () => {
      await asUser(ids.member);
      await signup("dps");
      for (const id of [ids.other, ids.officer]) {
        await asUser(id);
        assert.equal((await db.query("delete from public.event_rsvps where event_id = $1 returning role", [eventId])).rows.length, 0);
        assert.equal((await db.query("update public.event_rsvps set role = 'tank' where event_id = $1 returning role", [eventId])).rows.length, 0);
      }
    });
    it("blokuje zwykłemu graczowi edycję i usunięcie wydarzenia", async () => {
      await asUser(ids.member);
      assert.equal((await db.query("update public.events set status = 'cancelled' where id = $1 returning id", [eventId])).rows.length, 0);
      assert.equal((await db.query("delete from public.events where id = $1 returning id", [eventId])).rows.length, 0);
    });
    it("zamyka nowe zapisy i zmianę roli po odwołaniu, zachowuje listę i pozwala się wypisać", async () => {
      await asUser(ids.member);
      await signup("healer");
      await asUser(ids.officer);
      await db.query("update public.events set status = 'cancelled' where id = $1", [eventId]);
      await asUser(ids.member);
      await rejected("select public.save_event_rsvp($1, 'tank')", [eventId]);
      assert.equal((await db.query("select * from public.event_rsvps where event_id = $1", [eventId])).rows.length, 1);
      await asUser(ids.other);
      await rejected("select public.save_event_rsvp($1, 'dps')", [eventId]);
      await asUser(ids.member);
      assert.equal((await db.query("delete from public.event_rsvps where event_id = $1 and profile_id = auth.uid() returning role", [eventId])).rows.length, 1);
    });
    it("blokuje zapis po rozpoczęciu i dla zakończonych wydarzeń", async () => {
      for (const state of ["started", "completed"]) {
        await db.exec("reset role");
        if (state === "started") {
          // Testowy zegar: ustawiamy przeszłość jako właściciel bazy z pominięciem wyłącznie walidatora planowania.
          await db.exec("alter table public.events disable trigger event_schedule_valid");
          await db.query("update public.events set starts_at = now() - interval '1 minute' where id = $1", [eventId]);
          await db.exec("alter table public.events enable trigger event_schedule_valid");
        } else await db.query("update public.events set status = 'completed' where id = $1", [eventId]);
        await asUser(ids.member);
        await rejected("select public.save_event_rsvp($1, 'dps')", [eventId]);
      }
    });
    it("waliduje daty i cele składu również przy bezpośrednim SQL", async () => {
      await asUser(ids.officer);
      await rejected(`insert into public.events(title, event_type, starts_at, ends_at)
        values ('Przeszłość', 'pvp', now() - interval '1 hour', now() + interval '1 hour')`);
      await rejected("update public.events set ends_at = starts_at where id = $1", [eventId]);
      await rejected("update public.events set tanks_needed = -1 where id = $1", [eventId]);
      await rejected("update public.events set tanks_needed = 80, dps_needed = 1 where id = $1", [eventId]);
      await rejected("update public.events set starts_at = now() - interval '1 hour' where id = $1", [eventId]);
      await rejected(`insert into public.events(title, event_type, starts_at, ends_at)
        values ('Brak składu', 'pvp', now() + interval '1 day', now() + interval '2 days')`);
    });
    it("cele składu nie blokują dodatkowych zgłoszeń", async () => {
      await asUser(ids.member);
      await signup("healer");
      await asUser(ids.other);
      await signup("healer");
      const result = await db.query<{ count: number }>("select count(*)::int as count from public.event_rsvps where event_id = $1 and role = 'healer'", [eventId]);
      assert.equal(result.rows[0].count, 2);
    });
    it("zachowuje poprzednie wydarzenia i role przy aktualizacji", async () => {
      if (!legacy) return;
      const old = await db.query<{ tanks_needed: number }>("select tanks_needed from public.events where title = 'Zachowane wydarzenie'");
      assert.equal(old.rows[0].tanks_needed, 0);
      await asUser(ids.officer);
      assert.equal((await db.query<{ value: boolean }>("select public.is_guild_officer() as value")).rows[0].value, true);
    });
  });
}
