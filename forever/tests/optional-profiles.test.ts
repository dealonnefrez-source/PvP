import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const member = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";
const unverified = "00000000-0000-0000-0000-000000000003";
const existing = "00000000-0000-0000-0000-000000000004";

for (const legacy of [false, true]) {
  describe(legacy ? "Uproszczenie istniejącej bazy bez utraty danych" : "Minimalna instalacja w pustej bazie", () => {
    let db: PGlite;

    async function asUser(id: string) {
      await db.exec("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
    }

    async function rejected(sql: string, params: unknown[] = []) {
      await db.exec("savepoint rejection");
      await assert.rejects(db.query(sql, params));
      await db.exec("rollback to savepoint rejection; release savepoint rejection");
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
      if (legacy) {
        await db.exec(await readFile(new URL("../supabase/migrations/202610270001_initial_schema.sql", import.meta.url), "utf8"));
      }
      await db.query("insert into auth.users values ($1, now())", [existing]);
      if (legacy) {
        await db.query(`update public.profiles set character_name = 'Thrall', race = 'Orc',
          character_class = 'Shaman', realm = 'Forever', primary_professions = array['Mining'],
          onboarded_at = now(), guild_role = 'officer' where id = $1`, [existing]);
        await db.query(`insert into public.events(created_by, title, event_type, starts_at, ends_at)
          values ($1, 'Stare wydarzenie', 'raid', now() + interval '1 day', now() + interval '2 days')`, [existing]);
      }
      await db.exec(await readFile(new URL("../supabase/migrations/202610270002_optional_profiles.sql", import.meta.url), "utf8"));
      for (const id of [member, other, unverified]) {
        await db.query("insert into auth.users values ($1, $2)", [id, id === unverified ? null : "2026-01-01T00:00:00Z"]);
      }
    });
    after(async () => { await db?.close(); });
    beforeEach(async () => { await db.exec("begin"); });
    afterEach(async () => { await db.exec("rollback"); });

    it("tworzy profil dla nowego i wcześniej istniejącego konta", async () => {
      const result = await db.query("select id from public.profiles order by id");
      assert.equal(result.rows.length, 4);
      const profile = await db.query<{ character_name: string | null }>("select character_name from public.profiles where id = $1", [member]);
      assert.equal(profile.rows[0].character_name, null);
    });

    it("usuwa wymóg onboardingu; w nowej bazie tworzy wyłącznie profiles", async () => {
      const columns = await db.query<{ column_name: string }>("select column_name from information_schema.columns where table_schema = 'public' and table_name = 'profiles'");
      assert.equal(columns.rows.some((column) => column.column_name === "onboarded_at"), false);
      if (!legacy) {
        const tables = await db.query<{ tablename: string }>("select tablename from pg_tables where schemaname = 'public'");
        assert.deepEqual(tables.rows.map((table) => table.tablename), ["profiles"]);
      }
    });

    it("daje potwierdzonemu kontu dostęp i aktywność bez danych postaci", async () => {
      await asUser(member);
      assert.equal((await db.query("select * from public.profiles")).rows.length, 4);
      await db.exec("select public.touch_presence()");
      const active = await db.query<{ id: string; character_name: string | null; character_class: string | null }>("select * from public.active_players()");
      assert.ok(active.rows.some((row) => row.id === member && row.character_name === null && row.character_class === null));
      if (legacy) {
        assert.equal((await db.query("select * from public.events")).rows.length, 1);
        await db.exec(`insert into public.events(title, event_type, starts_at, ends_at)
          values ('Nowe wydarzenie', 'raid', now() + interval '1 day', now() + interval '2 days')`);
      }
    });

    it("pozwala zapisać częściowy profil, a następnie wyczyścić wszystkie pola", async () => {
      await asUser(member);
      await db.exec("update public.profiles set race = 'Orc' where id = auth.uid()");
      let result = await db.query<{ race: string | null; character_name: string | null }>("select race, character_name from public.profiles where id = auth.uid()");
      assert.deepEqual(result.rows[0], { race: "Orc", character_name: null });
      await db.exec("update public.profiles set character_name = null, realm = null, race = null, character_class = null, primary_professions = '{}' where id = auth.uid()");
      result = await db.query("select race, character_name from public.profiles where id = auth.uid()");
      assert.deepEqual(result.rows[0], { race: null, character_name: null });
    });

    it("chroni cudzy profil, identyfikatory, znaczniki czasu i ewentualne role", async () => {
      await asUser(member);
      assert.equal((await db.query("update public.profiles set character_name = 'Obcy' where id = $1 returning id", [other])).rows.length, 0);
      await rejected("update public.profiles set id = $1 where id = auth.uid()", [other]);
      await rejected("update public.profiles set last_active_at = now() where id = auth.uid()");
      await rejected("update public.profiles set created_at = now() where id = auth.uid()");
      if (legacy) await rejected("update public.profiles set guild_role = 'admin' where id = auth.uid()");
      await rejected("insert into public.profiles(id) values (auth.uid())");
      await rejected("delete from public.profiles where id = auth.uid()");
    });

    it("nadal wymaga potwierdzenia e-maila", async () => {
      await asUser(unverified);
      const profiles = await db.query<{ id: string }>("select id from public.profiles");
      assert.deepEqual(profiles.rows.map((row) => row.id), [unverified]);
      assert.equal((await db.query("update public.profiles set race = 'Orc' where id = auth.uid() returning id")).rows.length, 0);
      assert.equal((await db.query("select * from public.active_players()")).rows.length, 0);
      await rejected("select public.touch_presence()");
    });

    it("blokuje dostęp anonimowy", async () => {
      await db.exec("set local role anon");
      await rejected("select * from public.profiles");
      await rejected("select public.active_players()");
      await rejected("select public.touch_presence()");
    });

    it("odrzuca nieprawidłowe dane, ale nie wymaga kompletu pól", async () => {
      await asUser(member);
      await rejected("update public.profiles set race = 'Unknown' where id = auth.uid()");
      await rejected("update public.profiles set character_class = 'Unknown' where id = auth.uid()");
      await rejected("update public.profiles set primary_professions = array['Mining', 'Mining'] where id = auth.uid()");
      await rejected("update public.profiles set primary_professions = array['Fishing'] where id = auth.uid()");
      await rejected("update public.profiles set primary_professions = '[0:1]={Mining,Mining}'::text[] where id = auth.uid()");
    });

    it("zachowuje starą postać, rolę i wydarzenia, jeżeli istniały", async () => {
      if (!legacy) return;
      const profile = await db.query<{ character_name: string; guild_role: string; primary_professions: string[] }>("select character_name, guild_role, primary_professions from public.profiles where id = $1", [existing]);
      assert.deepEqual(profile.rows[0], { character_name: "Thrall", guild_role: "officer", primary_professions: ["Mining"] });
      assert.equal((await db.query("select * from public.events")).rows.length, 1);
      await asUser(existing);
      const permission = await db.query<{ officer: boolean }>("select private.is_officer() as officer");
      assert.equal(permission.rows[0].officer, true);
    });
  });
}
