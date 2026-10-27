import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHARACTER_CLASSES, CLASS_LABELS, PROFESSIONS, PROFESSION_LABELS, RACES, RACE_LABELS } from "../src/lib/wow";
import { COMBAT_ROLE_LABELS, EVENT_STATUS_LABELS, EVENT_TYPE_LABELS, GUILD_ROLE_LABELS, LFG_ACTIVITY_LABELS, LFG_STATUS_LABELS } from "../src/lib/labels";
import { loginSchema, profileSchema, registrationSchema } from "../src/lib/validation";

describe("Polski interfejs", () => {
  it("zapewnia etykiety wszystkich klas, ras i profesji bez zmiany wartości w bazie", () => {
    for (const [values, labels] of [
      [CHARACTER_CLASSES, CLASS_LABELS],
      [RACES, RACE_LABELS],
      [PROFESSIONS, PROFESSION_LABELS],
    ] as const) {
      assert.deepEqual(Object.keys(labels).sort(), [...values].sort());
      assert.ok(Object.values(labels).every((label) => label.trim().length > 0));
    }
    assert.equal(CLASS_LABELS.Shaman, "Szaman");
    assert.equal(RACE_LABELS.Orc, "Ork");
    assert.equal(PROFESSION_LABELS.Herbalism, "Zielarstwo");
    assert.ok(CHARACTER_CLASSES.includes("Shaman"));
    assert.ok(RACES.includes("Orc"));
    assert.ok(PROFESSIONS.includes("Herbalism"));
  });

  it("udostępnia polskie nazwy ról, wydarzeń i grup dla kolejnych funkcji", () => {
    assert.deepEqual(GUILD_ROLE_LABELS, { member: "Członek gildii", officer: "Oficer", admin: "Administrator" });
    assert.deepEqual(COMBAT_ROLE_LABELS, { tank: "Tank (obrońca)", healer: "Healer (uzdrowiciel)", dps: "DPS (obrażenia)" });
    assert.deepEqual(EVENT_TYPE_LABELS, { pvp: "Arena", battleground: "Premade BG", raid: "Rajd na miasto", other: "Inne" });
    assert.deepEqual(EVENT_STATUS_LABELS, { scheduled: "Zaplanowane", cancelled: "Odwołane", completed: "Zakończone" });
    assert.deepEqual(LFG_ACTIVITY_LABELS, { arena: "Arena", battleground: "Pole bitwy", mythic_plus: "Loch mityczny+", raid: "Rajd", other: "Inne" });
    assert.deepEqual(LFG_STATUS_LABELS, { open: "Otwarta", filled: "Kompletna", closed: "Zamknięta" });
  });

  it("zwraca polskie komunikaty logowania i rejestracji", () => {
    const invalidEmail = loginSchema.safeParse({ email: "błędny", password: "hasło" });
    assert.equal(invalidEmail.error?.issues[0].message, "Podaj poprawny adres e-mail.");
    const missingPassword = loginSchema.safeParse({ email: "gildia@example.com", password: "" });
    assert.equal(missingPassword.error?.issues[0].message, "Podaj hasło.");
    const shortPassword = registrationSchema.safeParse({ email: "gildia@example.com", password: "krótkie" });
    assert.equal(shortPassword.error?.issues[0].message, "Użyj co najmniej 12 znaków.");
    const longPassword = loginSchema.safeParse({ email: "gildia@example.com", password: "x".repeat(129) });
    assert.equal(longPassword.error?.issues[0].message, "Hasło może mieć maksymalnie 128 znaków.");
  });

  it("zwraca polskie komunikaty profilu, również dla zbyt długich i nieprawidłowych wartości", () => {
    const character = { character_name: "Thrall", realm: "Forever", race: "Orc", character_class: "Shaman", primary_professions: [] };
    for (const [change, message] of [
      [{ character_name: "x".repeat(25) }, "Nazwa postaci może mieć maksymalnie 24 znaki."],
      [{ realm: "x".repeat(81) }, "Nazwa serwera może mieć maksymalnie 80 znaków."],
      [{ race: "Nieznana" }, "Wybierz rasę."],
      [{ character_class: "Nieznana" }, "Wybierz klasę."],
      [{ primary_professions: ["Fishing"] }, "Wybierz profesję z listy."],
      [{ primary_professions: ["Mining", "Mining"] }, "Wybierz różne profesje."],
    ] as const) {
      const result = profileSchema.safeParse({ ...character, ...change });
      assert.equal(result.error?.issues[0].message, message);
    }
  });

  it("stosuje polską lokalizację Zod dla brakujących pól i błędnych typów", () => {
    for (const result of [loginSchema.safeParse({}), profileSchema.safeParse({ primary_professions: null })]) {
      assert.equal(result.success, false);
      for (const issue of result.error?.issues ?? []) {
        assert.doesNotMatch(issue.message, /Invalid|expected|received|Too (?:big|small)/);
      }
    }
  });
});
