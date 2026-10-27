# Forever guild hall

Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui (Base UI), and Supabase Auth/PostgreSQL.

## Język interfejsu

Interfejs gildii Forever jest polskojęzyczny (`lang="pl"`). Wszystkie nowe formularze, tabele, role, stany, komunikaty walidacji i powiadomienia również należy tworzyć po polsku.

Polskie etykiety klas, ras i profesji znajdują się w [katalogu postaci](src/lib/wow.ts), a nazwy ról, aktywności i stanów w [etykietach interfejsu](src/lib/labels.ts). Wartości zapisywane w bazie oraz adresy tras pozostają niezmienione; tłumaczone są etykiety widoczne dla użytkownika. Formularze mają polskie komunikaty walidacji zarówno po stronie serwera, jak i w przeglądarce. Nie wymaga to migracji istniejących danych.

Konfigurując wiadomości Supabase Auth, należy również używać polskich tematów i treści. W przykładowym szablonie poniżej tekst odnośnika jest już po polsku; pozostałą treść wiadomości należy ustawić w panelu Supabase.

## Milestones

- Implemented: Supabase SSR/browser clients, session refresh, registration, login/logout, email confirmation, protected character onboarding/editing, and a dashboard with recent website activity.
- Prepared: approved PostgreSQL schema for profiles, events, RSVPs, and LFG listings, including RLS and database constraints; server-only Discord webhook utility.
- Next: filterable guild roster; event scheduling and role-based RSVP screens; temporary LFG creation/search. Event/LFG mutation handlers must call the Discord utility after a successful database write. No event/LFG UI or delivery retry queue is implemented yet.

One account represents one main character. Verified, onboarded self-registrations receive guild access; this is **not an invite-only membership system**. “Active” means website activity within 15 minutes, not WoW login status.

## Prerequisites

- Node.js 22.13+ (Node.js 24 LTS recommended) and npm.
- A Supabase project. No Supabase credentials or hosted database are bundled.

The initial development environment did not have Node on PATH. A checksum-verified portable Node runtime was used for local validation only. Install Node normally for the following commands.

## Initialization commands

These are the equivalent commands used to create this project. **Do not scaffold again over this existing directory.**

```powershell
npx create-next-app@latest forever --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --disable-git --yes
Set-Location .\forever
npm install @supabase/ssr @supabase/supabase-js zod server-only
npx shadcn@latest init --defaults
npx shadcn@latest add button card input label badge --yes
npm install --save-dev @electric-sql/pglite tsx
```

For the already-generated application:

```powershell
Set-Location E:\WoW\PvP\forever
npm ci
Copy-Item .env.example .env.local
```

Edit `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
DISCORD_WEBHOOK_URL=
```

Use the project's **publishable key** from Supabase Settings > API Keys. Never use a secret/service-role key in the browser or a `NEXT_PUBLIC_` variable. The application does not need a service-role key. Restart the development server after changing environment variables. Production `NEXT_PUBLIC_` values are captured at build time: configure them **before** `npm run build`, and rebuild/redeploy when they change.

## Database setup

Run [the initial migration](supabase/migrations/202610270001_initial_schema.sql) in the Supabase SQL Editor as the database owner. It runs in a transaction and is intended to be applied once to a new project, not repeatedly. Alternatively, link this directory using the Supabase CLI and run `supabase db push`.

The migration creates:

| Table | Purpose |
| --- | --- |
| `auth.users` | Supabase-managed accounts (already exists in Supabase) |
| `public.profiles` | Character details, guild role, onboarding, website presence |
| `public.events` | Guild calendar and event lifecycle |
| `public.event_rsvps` | One selected combat role per member/event |
| `public.lfg_groups` | Temporary group advertisements and role vacancies |

RLS denies anonymous guild-data access. Members cannot directly mutate profiles, including guild roles and activity timestamps: authenticated RPCs handle character editing and throttled server-timestamped presence. Only verified, onboarded members can access shared guild data. Owners/officers manage events and LFG; each member manages only their own RSVPs.

The character catalog is a **starter retail-style superset**, not a confirmed server-specific catalog, and does not enforce race/class combinations. A WoW expansion/client version has not been specified. Before guild rollout, align [the shared options](src/lib/wow.ts) and the SQL catalog constraints with the guild's exact server/version. Catalog compatibility is covered by database tests.

To appoint the first admin, run a trusted SQL Editor operation after that member registers. Never expose this operation as a self-service profile field:

```sql
update public.profiles
set guild_role = 'admin'
where id = 'REPLACE_WITH_AUTH_USER_UUID';
```

Deleting an account removes its profile/RSVPs, but preserves organized events and LFG listings with nullable ownership. Officers can manage these orphaned listings. Event times use `timestamptz`. Future event screens must convert local inputs to instants and render them in the viewer's timezone. Future LFG queries must use both `status = 'open'` and `expires_at > now()`; stored status alone does not mean a listing is active.

## Supabase Auth setup

1. Enable the Email provider and **Confirm email** in Authentication > Providers.
2. Set the Site URL to `http://localhost:3000` for development and your HTTPS origin for production.
3. Add exact redirect URLs for `/auth/callback` on each permitted origin. Do not allow arbitrary production wildcard redirects.
4. Configure the **Confirm signup** email template to use this confirmation link:

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">Potwierdź konto w gildii Forever</a>
   ```

   This token-hash route works when the email is opened on a different device. The `/auth/callback` PKCE route is also available for flows returning an authorization code to the browser that initiated sign-up.

5. Configure a production SMTP provider and appropriate Supabase rate limits/CAPTCHA settings before opening registration publicly. Set the provider password minimum to at least 12 to match this application's registration rule.

Registration creates an incomplete profile. After email confirmation and login, members are redirected to `/onboarding`. Saving valid character details grants access to `/dashboard`. Revisit `/onboarding` to edit the character later. Zero to two primary professions are supported.

## Run and validate

```powershell
npm run dev
# Open http://localhost:3000
```

```powershell
npm run test
npm run lint
npm run typecheck
npm run build
npm run start
```

Without environment variables, the landing page is usable and auth/protected routes show setup instructions instead of simulated data. A real registration/login/email test requires your configured Supabase project and inbox.

Tests execute the actual migration in an in-memory PostgreSQL engine (PGlite) with a minimal test-only `auth.users`/`auth.uid()` implementation. They cover profile triggers, email/onboarding gates, catalog consistency, RLS/grants, privilege escalation prevention, ownership, RSVP uniqueness/closed events, presence throttling, and deletion behavior. They do **not** substitute for hosted Supabase Auth, PostgREST integration, or email delivery tests.

After hosted setup, verify manually:

1. Register and confirm the email; logging in before confirmation must fail.
2. Visit `/dashboard` before onboarding; expect `/onboarding`.
3. Save a character; expect `/dashboard`. Refresh to see recent activity.
4. Edit the character, log out, and verify protected routes return to login.
5. Register a second account and verify that it cannot see guild data before onboarding or change another account's profile/role.

The browser sends a presence heartbeat only while the dashboard tab is visible, every five minutes and when returning to the tab. Requests must originate from the canonical `NEXT_PUBLIC_SITE_URL` origin; use that hostname in the browser rather than a local IP alias. The database throttles actual writes to one per minute. Active-player results are server-rendered; refresh to update the list.

## Discord preparation

[notifyDiscord](src/lib/discord.ts) reads the optional server-only `DISCORD_WEBHOOK_URL`. It accepts event/LFG notification details, restricts webhook destinations to Discord, disables mention parsing, applies Discord field limits, times out after five seconds, and rejects delivery errors. Missing configuration is logged as disabled.

When implementing creation handlers, persist the event/LFG first, then call this utility in a separate notification step. Catch and log notification failures without webhook tokens and without rolling back or misreporting the successful database write. Do not tell the user that Discord delivery succeeded unless it did. Durable delivery/retries need an outbox or background job and are outside this first milestone.

## Structure

```text
src\
  app\
    (auth)\                 Login, registration, auth server actions
    auth\callback\           PKCE code exchange
    auth\confirm\            Email token confirmation
    onboarding\             Protected character form and server action
    dashboard\              Protected member dashboard
    api\presence\            Authenticated same-origin activity heartbeat
    setup\                  Missing-configuration instructions
  components\
    ui\                     Generated shadcn/ui components
  lib\
    supabase\               Typed browser/read-only server/writable server clients
    auth.ts                 Verified member and onboarding guards
    database.types.ts       Types matching the initial schema
    wow.ts                  Centralized character choices
    validation.ts           Shared form validation
    discord.ts              Server-only webhook delivery
  proxy.ts                  Next.js 16 session cookie refresh
supabase\
  migrations\               SQL schema, functions, grants and RLS
tests\                      Validation, presence, payload and PostgreSQL tests
```

`database.types.ts` is maintained against this initial migration. After connecting to Supabase, regenerate database types with the Supabase CLI whenever the schema changes, preserving any application aliases (`Profile`, etc.) in a separate module if needed.
