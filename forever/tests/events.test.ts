import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calendarMonth, canSignUp, eventSchema, guildDateKey, localDateTimeToIso, roleSummary, roleTarget, rsvpSchema } from "../src/lib/events";

const valid = {
  title: "Premade BG", description: "", event_type: "battleground",
  starts_at: "2030-10-27T18:00:00.000Z", ends_at: "2030-10-27T20:00:00.000Z",
  tanks_needed: 0, healers_needed: 3, dps_needed: 7,
};

describe("Walidacja wydarzeń i RSVP", () => {
  it("przyjmuje poprawne wydarzenie i konwertuje liczby z formularza", () => {
    assert.equal(eventSchema.parse({ ...valid, dps_needed: "7" }).dps_needed, 7);
  });
  it("odrzuca zły czas, typ, tytuł i cele składu", () => {
    for (const change of [
      { title: " " }, { title: "x".repeat(121) }, { description: "x".repeat(4001) },
      { event_type: "unknown" }, { ends_at: valid.starts_at },
      { starts_at: "2030-10-27T18:00" }, { healers_needed: -1 }, { tanks_needed: 0.5 },
      { tanks_needed: 0, healers_needed: 0, dps_needed: 0 },
      { tanks_needed: 80, healers_needed: 1, dps_needed: 0 },
    ]) assert.equal(eventSchema.safeParse({ ...valid, ...change }).success, false);
  });
  it("wymaga konkretnej roli i prawidłowego identyfikatora wydarzenia", () => {
    const event_id = "6a4fb5b2-1c76-4b9b-8a36-e79d92af30dd";
    for (const role of ["tank", "healer", "dps"]) assert.equal(rsvpSchema.safeParse({ event_id, role }).success, true);
    for (const data of [{ event_id }, { event_id, role: "unknown" }, { event_id: "bad", role: "tank" }]) {
      assert.equal(rsvpSchema.safeParse(data).success, false);
    }
  });
  it("nie pokazuje angielskich komunikatów przy brakujących polach ani błędnej liczbie", () => {
    for (const result of [eventSchema.safeParse({}), eventSchema.safeParse({ ...valid, tanks_needed: "abc" })]) {
      assert.equal(result.success, false);
      for (const issue of result.error?.issues ?? []) assert.doesNotMatch(issue.message, /Invalid|expected|received/);
    }
  });
  it("liczy braki i nadwyżki osobno, bez ujemnych liczb", () => {
    assert.deepEqual(roleSummary(3, 1), { missing: 2, extra: 0 });
    assert.deepEqual(roleSummary(3, 3), { missing: 0, extra: 0 });
    assert.deepEqual(roleSummary(3, 5), { missing: 0, extra: 2 });
    assert.deepEqual(roleSummary(0, 2), { missing: 0, extra: 2 });
    assert.equal(roleTarget(valid, "tank"), 0);
    assert.equal(roleTarget(valid, "healer"), 3);
    assert.equal(roleTarget(valid, "dps"), 7);
  });
  it("zamyka zapisy dokładnie z chwilą rozpoczęcia oraz przy odwołaniu", () => {
    const event = { status: "scheduled" as const, starts_at: valid.starts_at };
    const start = Date.parse(valid.starts_at);
    assert.equal(canSignUp(event, start - 1), true);
    assert.equal(canSignUp(event, start), false);
    assert.equal(canSignUp({ ...event, status: "cancelled" }, start - 1), false);
    assert.equal(canSignUp({ ...event, status: "completed" }, start - 1), false);
  });
});

describe("Kalendarz i strefy czasowe", () => {
  it("buduje 42 dni od poniedziałku, przekracza rok i uwzględnia luty przestępny", () => {
    const calendar = calendarMonth("2028-02");
    assert.equal(calendar.days.length, 42);
    assert.equal(new Date(calendar.days[0]).getUTCDay(), 1);
    assert.ok(calendar.days.includes("2028-02-29"));
    assert.equal(calendarMonth("2030-01").previous, "2029-12");
    assert.equal(calendarMonth("2030-12").next, "2031-01");
  });
  it("odrzuca niepoprawne miesiące zamiast normalizować daty", () => {
    for (const value of ["2030-13", "2030-00", "2030-1", "x", "1900-01"]) assert.throws(() => calendarMonth(value));
  });
  it("przypisuje wydarzenie do dnia w Polsce, nie według UTC", () => {
    assert.equal(guildDateKey("2030-07-01T22:30:00Z"), "2030-07-02");
    assert.equal(guildDateKey("2030-01-01T22:30:00Z"), "2030-01-01");
  });
  it("konwertuje czas lokalny do UTC i odrzuca nieistniejącą godzinę zmiany czasu", () => {
    const original = process.env.TZ;
    process.env.TZ = "Europe/Warsaw";
    try {
      assert.equal(localDateTimeToIso("2030-01-01T19:00"), "2030-01-01T18:00:00.000Z");
      assert.equal(localDateTimeToIso("2030-07-01T19:00"), "2030-07-01T17:00:00.000Z");
      assert.throws(() => localDateTimeToIso("2030-03-31T02:30"), /nie istnieje/);
      assert.throws(() => localDateTimeToIso("2030-02-30T12:00"));
      assert.throws(() => localDateTimeToIso(""));
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});
