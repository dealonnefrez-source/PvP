import { z } from "zod";
import { pl } from "zod/locales";
import { CHARACTER_CLASSES, PROFESSIONS, RACES } from "./wow";

z.config(pl());

export const loginSchema = z.object({
  email: z.email("Podaj poprawny adres e-mail.").trim().max(254, "Adres e-mail może mieć maksymalnie 254 znaki."),
  password: z.string().min(1, "Podaj hasło.").max(128, "Hasło może mieć maksymalnie 128 znaków."),
});

export const registrationSchema = loginSchema.extend({
  password: z.string().min(12, "Użyj co najmniej 12 znaków.").max(128, "Użyj nie więcej niż 128 znaków."),
});

const optionalField = <T extends z.ZodType>(schema: T) => z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  schema.nullable(),
);

export const profileSchema = z.object({
  character_name: optionalField(z.string().trim().min(2, "Nazwa postaci musi mieć co najmniej 2 znaki.").max(24, "Nazwa postaci może mieć maksymalnie 24 znaki.")
    .regex(/^[\p{L}][\p{L}'-]*$/u, "W nazwie postaci użyj liter, apostrofów lub łączników.")),
  realm: optionalField(z.string().trim().min(2, "Podaj nazwę serwera (co najmniej 2 znaki).").max(80, "Nazwa serwera może mieć maksymalnie 80 znaków.")),
  race: optionalField(z.enum(RACES, { error: "Wybierz rasę." })),
  character_class: optionalField(z.enum(CHARACTER_CLASSES, { error: "Wybierz klasę." })),
  primary_professions: z.array(z.enum(PROFESSIONS, { error: "Wybierz profesję z listy." })).max(2, "Wybierz maksymalnie dwie profesje główne.")
    .refine((values) => new Set(values).size === values.length, "Wybierz różne profesje."),
});

export type FormState = { error?: string; success?: string };
