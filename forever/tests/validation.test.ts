import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loginSchema, onboardingSchema, registrationSchema } from "../src/lib/validation";
import { buildDiscordPayload } from "../src/lib/discord-payload";

const character = {
  character_name: "Thrall",
  realm: "Forever",
  race: "Orc",
  character_class: "Shaman",
  primary_professions: ["Alchemy", "Herbalism"],
};

describe("authentication validation", () => {
  it("requires a real email and a 12-character registration password", () => {
    assert.equal(registrationSchema.safeParse({ email: "guild@example.com", password: "long-passphrase" }).success, true);
    assert.equal(registrationSchema.safeParse({ email: "guild@example.com", password: "short" }).success, false);
    assert.equal(registrationSchema.safeParse({ email: "not-an-email", password: "long-passphrase" }).success, false);
  });
  it("does not apply the new registration password minimum to existing logins", () => {
    assert.equal(loginSchema.safeParse({ email: "guild@example.com", password: "old-pass" }).success, true);
    assert.equal(loginSchema.safeParse({ email: "guild@example.com", password: "" }).success, false);
  });
});

describe("character validation", () => {
  it("accepts and trims a complete character", () => {
    assert.equal(onboardingSchema.parse({ ...character, character_name: " Thrall " }).character_name, "Thrall");
  });
  it("permits zero professions", () => {
    assert.equal(onboardingSchema.safeParse({ ...character, primary_professions: [] }).success, true);
  });
  it("rejects duplicated, unknown, and excessive professions", () => {
    for (const primary_professions of [["Mining", "Mining"], ["Fishing"], ["Mining", "Skinning", "Alchemy"]]) {
      assert.equal(onboardingSchema.safeParse({ ...character, primary_professions }).success, false);
    }
  });
  it("rejects unknown races and classes, blank realms, and malformed names", () => {
    for (const change of [{ race: "Unknown" }, { character_class: "Unknown" }, { realm: " " }, { character_name: "<script>" }]) {
      assert.equal(onboardingSchema.safeParse({ ...character, ...change }).success, false);
    }
  });
  it("supports accented character names", () => {
    assert.equal(onboardingSchema.safeParse({ ...character, character_name: "Éowyn" }).success, true);
  });
});

describe("Discord payloads", () => {
  it("formats both notification types and suppresses Discord mentions", () => {
    for (const kind of ["event", "lfg"] as const) {
      const payload = buildDiscordPayload({ kind, title: "@everyone", description: "Join us", url: "https://guild.example.com/dashboard" });
      assert.deepEqual(payload.allowed_mentions, { parse: [] });
      assert.equal(payload.username, "Gildia Forever");
      assert.equal(payload.embeds[0].title.startsWith(kind === "event" ? "Nowe wydarzenie gildii:" : "Nowa grupa:"), true);
    }
  });
  it("enforces Discord field limits", () => {
    const payload = buildDiscordPayload({ kind: "event", title: "x".repeat(300), description: "x".repeat(5000), url: "https://guild.example.com" });
    assert.equal(payload.embeds[0].title.length, 256);
    assert.equal(payload.embeds[0].description.length, 4096);
  });
  it("rejects non-web links", () => {
    assert.throws(() => buildDiscordPayload({ kind: "lfg", title: "Arena", description: "", url: "javascript:alert(1)" }));
  });
});
