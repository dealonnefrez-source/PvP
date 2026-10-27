import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, after, beforeEach, afterEach, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { CHARACTER_CLASSES, PROFESSIONS, RACES } from "../src/lib/wow";

const ids = {
  member: "00000000-0000-0000-0000-000000000001",
  other: "00000000-0000-0000-0000-000000000002",
  officer: "00000000-0000-0000-0000-000000000003",
  newbie: "00000000-0000-0000-0000-000000000004",
  unverified: "00000000-0000-0000-0000-000000000005",
};
let db: PGlite;

async function asUser(id: string) {
  await db.exec("set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
}

async function expectRejected(sql: string, params: unknown[] = [], pattern = /permission|policy|constraint|closed|required|duplicate/i) {
  await db.exec("savepoint rejection");
  await assert.rejects(db.query(sql, params), pattern);
  await db.exec("rollback to savepoint rejection; release savepoint rejection");
}

async function createEvent() {
  const result = await db.query<{ id: string }>(`
    insert into public.events(title, event_type, starts_at, ends_at)
    values ('Guild battleground', 'battleground', now() + interval '1 day', now() + interval '2 days')
    returning id
  `);
  return result.rows[0].id;
}

describe("approved PostgreSQL schema and access controls", () => {
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
    await db.exec(await readFile(new URL("../supabase/migrations/202610270001_initial_schema.sql", import.meta.url), "utf8"));
    for (const [name, id] of Object.entries(ids)) {
      await db.query("insert into auth.users(id, email_confirmed_at) values ($1, $2)", [id, name === "unverified" ? null : "2026-01-01T00:00:00Z"]);
      if (name !== "newbie" && name !== "unverified") {
        await db.query(`
          update public.profiles set character_name = 'Thrall', realm = 'Forever',
          race = 'Orc', character_class = 'Shaman', onboarded_at = now(),
          guild_role = $2::public.guild_role where id = $1
        `, [id, name === "officer" ? "officer" : "member"]);
      }
    }
  });
  after(async () => { await db?.close(); });
  beforeEach(async () => { await db.exec("begin"); });
  afterEach(async () => { await db.exec("rollback"); });

  it("automatically creates an incomplete, ordinary member profile", async () => {
    const result = await db.query<{ guild_role: string; onboarded_at: null }>("select guild_role, onboarded_at from public.profiles where id = $1", [ids.newbie]);
    assert.deepEqual(result.rows[0], { guild_role: "member", onboarded_at: null });
  });
  it("denies anonymous table reads and onboarding RPC execution", async () => {
    await db.exec("set local role anon");
    await expectRejected("select * from public.profiles");
    await expectRejected("select * from public.events");
    await expectRejected("select * from public.event_rsvps");
    await expectRejected("select * from public.lfg_groups");
    await expectRejected("select public.complete_onboarding('Thrall', 'Forever', 'Orc', 'Shaman', '{}')");
  });
  it("lets a newcomer see only their own profile and no guild events", async () => {
    await asUser(ids.member);
    await createEvent();
    await asUser(ids.newbie);
    const profiles = await db.query<{ id: string }>("select id from public.profiles");
    assert.deepEqual(profiles.rows.map((row) => row.id), [ids.newbie]);
    assert.equal((await db.query("select * from public.events")).rows.length, 0);
    await expectRejected("insert into public.events(title, event_type, starts_at, ends_at) values ('Not yet', 'raid', now(), now() + interval '1 day')");
    await expectRejected("select public.touch_presence()");
  });
  it("onboards only the caller and preserves the original onboarding timestamp when edited", async () => {
    await asUser(ids.newbie);
    await db.exec("select public.complete_onboarding('Jaina', 'Forever', 'Human', 'Mage', array['Alchemy', 'Herbalism'])");
    const first = await db.query<{ onboarded_at: Date; character_name: string; guild_role: string }>("select onboarded_at, character_name, guild_role from public.profiles where id = auth.uid()");
    assert.equal(first.rows[0].character_name, "Jaina");
    assert.equal(first.rows[0].guild_role, "member");
    assert.ok(first.rows[0].onboarded_at);
    await db.exec("select public.complete_onboarding('Jainaa', 'Forever', 'Human', 'Mage', '{}')");
    const edited = await db.query<{ onboarded_at: Date }>("select onboarded_at from public.profiles where id = auth.uid()");
    assert.deepEqual(edited.rows[0].onboarded_at, first.rows[0].onboarded_at);
    assert.equal((await db.query("select id from public.profiles")).rows.length, 4);
  });
  it("requires verified email even when calling onboarding directly", async () => {
    await asUser(ids.unverified);
    await expectRejected("select public.complete_onboarding('Thrall', 'Forever', 'Orc', 'Shaman', '{}')");
  });
  it("prevents self-promotion, direct profile edits, and forged presence", async () => {
    await asUser(ids.member);
    await expectRejected("update public.profiles set guild_role = 'admin' where id = auth.uid()");
    await expectRejected("update public.profiles set character_name = 'Other' where id = auth.uid()");
    await expectRejected("update public.profiles set last_active_at = now() + interval '1 year' where id = auth.uid()");
  });
  it("keeps all frontend catalog options compatible with the database", async () => {
    await asUser(ids.member);
    for (const race of RACES) {
      await db.query("select public.complete_onboarding('Thrall', 'Forever', $1, 'Mage', '{}')", [race]);
    }
    for (const characterClass of CHARACTER_CLASSES) {
      await db.query("select public.complete_onboarding('Thrall', 'Forever', 'Human', $1, '{}')", [characterClass]);
    }
    for (const profession of PROFESSIONS) {
      await db.query("select public.complete_onboarding('Thrall', 'Forever', 'Human', 'Mage', $1::text[])", [[profession]]);
    }
  });
  it("rejects invalid profession arrays, missing details, and unknown catalog values at the database boundary", async () => {
    await asUser(ids.member);
    for (const professions of [["Mining", "Mining"], ["Fishing"], ["Alchemy", "Mining", "Skinning"], [null]]) {
      await expectRejected("select public.complete_onboarding('Thrall', 'Forever', 'Orc', 'Shaman', $1::text[])", [professions]);
    }
    await expectRejected("select public.complete_onboarding(null, 'Forever', 'Orc', 'Shaman', '{}')");
    await expectRejected("select public.complete_onboarding('Thrall', 'Forever', 'Unknown', 'Shaman', '{}')");
    await expectRejected("select public.complete_onboarding('Thrall', 'Forever', 'Orc', 'Unknown', '{}')");
  });
  it("uses server-controlled activity and throttles updates within a minute", async () => {
    await db.query("update public.profiles set last_active_at = now() - interval '20 minutes' where id = $1", [ids.member]);
    await asUser(ids.member);
    await db.exec("select public.touch_presence()");
    const first = await db.query<{ recent: boolean }>("select last_active_at >= now() - interval '1 second' as recent from public.profiles where id = auth.uid()");
    assert.equal(first.rows[0].recent, true);
    await db.exec("reset role");
    await db.query("update public.profiles set last_active_at = now() - interval '30 seconds' where id = $1", [ids.member]);
    await asUser(ids.member);
    await db.exec("select public.touch_presence()");
    const throttled = await db.query<{ unchanged: boolean }>("select last_active_at = now() - interval '30 seconds' as unchanged from public.profiles where id = auth.uid()");
    assert.equal(throttled.rows[0].unchanged, true);
  });
  it("queries the exact 15-minute website activity boundary, excluding older, missing, and future activity", async () => {
    for (const [expression, expected] of [
      ["now() - interval '15 minutes'", true],
      ["now() - interval '15 minutes 0.001 seconds'", false],
      ["now()", true],
      ["now() + interval '0.001 seconds'", false],
      ["null", false],
    ] as const) {
      await db.exec("reset role");
      await db.query(`update public.profiles set last_active_at = ${expression} where id = $1`, [ids.member]);
      await asUser(ids.member);
      const active = await db.query<{ id: string }>("select id from public.active_players()");
      assert.equal(active.rows.some((row) => row.id === ids.member), expected);
    }
    await asUser(ids.newbie);
    assert.equal((await db.query("select * from public.active_players()")).rows.length, 0);
  });
  it("lets members create events but not impersonate the organizer", async () => {
    await asUser(ids.member);
    const id = await createEvent();
    assert.ok(id);
    await expectRejected(
      "insert into public.events(created_by, title, event_type, starts_at, ends_at) values ($1, 'Forged owner', 'raid', now(), now() + interval '1 day')",
      [ids.other],
    );
    await expectRejected("update public.events set created_by = $1 where id = $2", [ids.other, id]);
    await expectRejected("insert into public.events(title, event_type, starts_at, ends_at) values ('Bad time', 'raid', now() + interval '1 day', now())");
  });
  it("limits event management to the organizer and officers", async () => {
    await asUser(ids.member);
    const id = await createEvent();
    await asUser(ids.other);
    assert.equal((await db.query("update public.events set title = 'Unauthorized edit' where id = $1 returning id", [id])).rows.length, 0);
    assert.equal((await db.query("delete from public.events where id = $1 returning id", [id])).rows.length, 0);
    await asUser(ids.officer);
    assert.equal((await db.query("update public.events set title = 'Officer edit' where id = $1 returning id", [id])).rows.length, 1);
    await asUser(ids.member);
    assert.equal((await db.query("update public.events set title = 'Organizer edit' where id = $1 returning id", [id])).rows.length, 1);
  });
  it("enforces one RSVP per member, self-ownership, role changes, and withdrawal", async () => {
    await asUser(ids.member);
    const eventId = await createEvent();
    await db.query("insert into public.event_rsvps(event_id, profile_id, role) values ($1, auth.uid(), 'dps')", [eventId]);
    await expectRejected("insert into public.event_rsvps(event_id, profile_id, role) values ($1, auth.uid(), 'healer')", [eventId]);
    await expectRejected("insert into public.event_rsvps(event_id, profile_id, role) values ($1, $2, 'healer')", [eventId, ids.other]);
    await asUser(ids.other);
    assert.equal((await db.query("update public.event_rsvps set role = 'tank' where event_id = $1 returning role", [eventId])).rows.length, 0);
    assert.equal((await db.query("delete from public.event_rsvps where event_id = $1 returning role", [eventId])).rows.length, 0);
    await asUser(ids.member);
    const changed = await db.query<{ role: string }>("update public.event_rsvps set role = 'healer' where event_id = $1 returning role", [eventId]);
    assert.equal(changed.rows[0].role, "healer");
    assert.equal((await db.query("delete from public.event_rsvps where event_id = $1 returning role", [eventId])).rows.length, 1);
  });
  it("closes sign-ups for cancelled, completed, and already-started events", async () => {
    await asUser(ids.member);
    const eventId = await createEvent();
    for (const status of ["cancelled", "completed"]) {
      await db.query("update public.events set status = $1::public.event_status where id = $2", [status, eventId]);
      await expectRejected("insert into public.event_rsvps(event_id, profile_id, role) values ($1, auth.uid(), 'dps')", [eventId]);
    }
    await db.query("update public.events set status = 'scheduled', starts_at = now() where id = $1", [eventId]);
    await expectRejected("insert into public.event_rsvps(event_id, profile_id, role) values ($1, auth.uid(), 'dps')", [eventId]);
  });
  it("protects LFG ownership and validates vacancies and expiry", async () => {
    await asUser(ids.member);
    const created = await db.query<{ id: string }>("insert into public.lfg_groups(title, activity, expires_at) values ('Arena tonight', 'arena', now() + interval '1 hour') returning id");
    const id = created.rows[0].id;
    await expectRejected("insert into public.lfg_groups(title, activity, expires_at, tanks_needed) values ('Bad slots', 'arena', now() + interval '1 hour', -1)");
    await expectRejected("insert into public.lfg_groups(title, activity, expires_at) values ('Already expired', 'arena', now() - interval '1 hour')");
    await expectRejected("update public.lfg_groups set dps_needed = 0 where id = $1", [id]);
    await asUser(ids.other);
    assert.equal((await db.query("update public.lfg_groups set title = 'Hijacked' where id = $1 returning id", [id])).rows.length, 0);
    await asUser(ids.officer);
    assert.equal((await db.query("update public.lfg_groups set status = 'closed' where id = $1 returning id", [id])).rows.length, 1);
  });
  it("retains listings but removes the deleted account's profile and RSVPs", async () => {
    await asUser(ids.member);
    const eventId = await createEvent();
    await db.query("insert into public.event_rsvps(event_id, profile_id, role) values ($1, auth.uid(), 'dps')", [eventId]);
    await db.exec("insert into public.lfg_groups(title, activity, expires_at) values ('Arena tonight', 'arena', now() + interval '1 hour')");
    await db.exec("reset role");
    await db.query("delete from auth.users where id = $1", [ids.member]);
    assert.equal((await db.query("select id from public.profiles where id = $1", [ids.member])).rows.length, 0);
    assert.equal((await db.query("select * from public.event_rsvps")).rows.length, 0);
    assert.equal((await db.query<{ created_by: null }>("select created_by from public.events where id = $1", [eventId])).rows[0].created_by, null);
    assert.equal((await db.query<{ created_by: null }>("select created_by from public.lfg_groups")).rows[0].created_by, null);
  });
});
