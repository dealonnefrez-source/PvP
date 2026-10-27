import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { isGuildOfficer } from "../src/lib/guild";

const member = "fb46e698-9408-4efb-8b05-000000000001";
const officer = "fb46e698-9408-4efb-8b05-000000000002";
const master = "fb46e698-9408-4efb-8b05-000000000003";
const unverified = "fb46e698-9408-4efb-8b05-000000000004";

for (const legacy of [false, true]) {
describe(`Role i wydarzenia otwarte — migracja 004 (${legacy ? "stary schemat" : "minimalna baza"})`, () => {
  let db: PGlite;
  let preservedEventId: string;
  async function asUser(id: string) {
    await db.exec("set local role authenticated");
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
  }
  async function reject(sql: string, values: unknown[] = []) {
    await db.exec("savepoint rejection");
    await assert.rejects(db.query(sql, values));
    await db.exec("rollback to savepoint rejection; release savepoint rejection");
  }
  async function create() {
    const result = await db.query<{ id: string }>(`insert into public.events(title, description, starts_at, ends_at)
      values ('Otwarte wydarzenie', 'Wspólna gra', now() + interval '1 day', now() + interval '2 days') returning id`);
    return result.rows[0].id;
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
    const migrations = [
      ...(legacy ? ["202610270001_initial_schema.sql"] : []),
      "202610270002_optional_profiles.sql", "202610270003_pvp_events.sql",
    ];
    for (const name of migrations) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
    }
    for (const id of [member, officer, master, unverified]) {
      await db.query("insert into auth.users values ($1, $2)", [id, id === unverified ? null : "2026-01-01"]);
    }
    await db.query("update public.profiles set guild_role = 'officer' where id = $1", [officer]);
    await db.query("update public.profiles set guild_role = 'admin' where id = $1", [master]);
    preservedEventId = (await db.query<{ id: string }>(`insert into public.events(title, event_type, starts_at, ends_at, created_by, dps_needed)
      values ('Dawne wydarzenie', 'pvp', now() + interval '1 day', now() + interval '2 days', $1, 5) returning id`, [master])).rows[0].id;
    await db.query("insert into public.event_rsvps(event_id, profile_id, role) values ($1, $2, 'healer')", [preservedEventId, member]);
    await db.exec(await readFile(new URL("../supabase/migrations/202610270004_guild_roles_open_events.sql", import.meta.url), "utf8"));
  });
  after(async () => { await db.close(); });
  beforeEach(async () => { await db.exec("begin"); });
  afterEach(async () => { await db.exec("rollback"); });

  it("zachowuje przypisania i zmienia admin na guild_master", async () => {
    const result = await db.query<{ guild_role: string }>("select guild_role from public.profiles where id = $1", [master]);
    assert.equal(result.rows[0].guild_role, "guild_master");
    const roles = await db.query<{ enumlabel: string }>("select enumlabel from pg_enum where enumtypid = 'public.guild_role'::regtype order by enumsortorder");
    assert.deepEqual(roles.rows.map(row => row.enumlabel), ["member", "officer", "guild_master"]);
    assert.equal((await db.query<{ guild_role: string }>("select guild_role from public.profiles where id = $1", [member])).rows[0].guild_role, "member");
    await asUser(master);
    assert.equal((await db.query<{ value: boolean }>("select public.is_guild_officer() as value")).rows[0].value, true);
  });
  it("zachowuje poprzednie wydarzenia i zapisy z rolami", async () => {
    await asUser(member);
    const events = await db.query<{ title: string; created_by: string }>("select title, created_by from public.events where id = $1", [preservedEventId]);
    assert.deepEqual(events.rows[0], { title: "Dawne wydarzenie", created_by: master });
    const rsvps = await db.query<{ role: string }>("select role from public.event_rsvps where event_id = $1 and profile_id = $2", [preservedEventId, member]);
    assert.equal(rsvps.rows[0].role, "healer");
  });
  it("daje potwierdzonemu graczowi listę wszystkich kont, także bez postaci i potwierdzenia", async () => {
    await asUser(member);
    assert.equal((await db.query("select * from public.profiles")).rows.length, 4);
  });
  it("zwykły gracz nie może zmieniać ról przez RPC ani bezpośrednio", async () => {
    await asUser(member);
    await reject("select public.set_guild_role($1, 'guild_master')", [member]);
    await reject("update public.profiles set guild_role = 'officer' where id = auth.uid()");
  });
  it("oficer i mistrz gildii nadają każdą rolę, również innym zarządzającym", async () => {
    for (const actor of [officer, master]) {
      await asUser(actor);
      for (const role of ["member", "officer", "guild_master"]) {
        await db.query("select public.set_guild_role($1, $2::public.guild_role)", [member, role]);
        const result = await db.query<{ guild_role: string }>("select guild_role from public.profiles where id = $1", [member]);
        assert.equal(result.rows[0].guild_role, role);
      }
    }
    await asUser(officer);
    await db.query("select public.set_guild_role($1, 'member')", [master]);
  });
  it("samodegradacja natychmiast odbiera prawo zmiany ról", async () => {
    await asUser(officer);
    await db.query("select public.set_guild_role($1, 'member')", [officer]);
    await reject("select public.set_guild_role($1, 'officer')", [officer]);
  });
  it("blokuje anonimowe i niepotwierdzone operacje", async () => {
    await db.exec("set local role anon");
    await reject("select public.set_guild_role($1, 'officer')", [member]);
    await db.exec("reset role");
    await db.query("update public.profiles set guild_role = 'officer' where id = $1", [unverified]);
    await asUser(unverified);
    await reject("select public.set_guild_role($1, 'officer')", [member]);
    await reject(`insert into public.events(title, starts_at, ends_at)
      values ('Niedostępne', now() + interval '1 day', now() + interval '2 days')`);
  });
  it("pozwala każdemu tworzyć wydarzenie z domyślną kategorią i zerowymi celami", async () => {
    await asUser(member);
    const id = await create();
    await reject(`insert into public.events(title, starts_at, ends_at, created_by)
      values ('Podszywanie się', now() + interval '1 day', now() + interval '2 days', $1)`, [officer]);
    await reject("update public.events set created_by = $1 where id = $2", [officer, id]);
    const result = await db.query<{ event_type: string; created_by: string }>("select event_type, created_by from public.events where id = $1", [id]);
    assert.deepEqual(result.rows[0], { event_type: "other", created_by: member });
    await db.query("select public.save_event_rsvp($1, 'dps')", [id]);
  });
  it("autor zarządza swoim wydarzeniem, ale nie cudzym; oficer zarządza oboma", async () => {
    await asUser(member);
    const own = await create();
    await asUser(officer);
    const other = await create();
    await asUser(member);
    assert.equal((await db.query("update public.events set status = 'cancelled' where id = $1 returning id", [own])).rows.length, 1);
    assert.equal((await db.query("update public.events set status = 'cancelled' where id = $1 returning id", [other])).rows.length, 0);
    await asUser(officer);
    assert.equal((await db.query("update public.events set status = 'cancelled' where id = $1 returning id", [other])).rows.length, 1);
  });
  it("bieżąca rola autora zmienia wyróżnienie również dawnych wydarzeń", async () => {
    await asUser(member);
    const id = await create();
    const query = `select p.guild_role from public.events e join public.profiles p on p.id = e.created_by where e.id = $1`;
    assert.equal(isGuildOfficer((await db.query<{ guild_role: "member" }>(query, [id])).rows[0].guild_role), false);
    await asUser(officer);
    await db.query("select public.set_guild_role($1, 'officer')", [member]);
    assert.equal(isGuildOfficer((await db.query<{ guild_role: "officer" }>(query, [id])).rows[0].guild_role), true);
    await db.query("select public.set_guild_role($1, 'member')", [member]);
    assert.equal(isGuildOfficer((await db.query<{ guild_role: "member" }>(query, [id])).rows[0].guild_role), false);
  });
});
}
