-- Uruchom po migracji 002, raz w Supabase SQL Editor jako postgres.
-- Zachowuje dane również wtedy, gdy wcześniej wykonano migrację 001.
begin;

do $$
begin
  if to_regtype('public.guild_role') is null then
    create type public.guild_role as enum ('member', 'officer', 'admin');
  end if;
  if to_regtype('public.combat_role') is null then
    create type public.combat_role as enum ('tank', 'healer', 'dps');
  end if;
  if to_regtype('public.event_type') is null then
    create type public.event_type as enum ('pvp', 'battleground', 'raid', 'other');
  end if;
  if to_regtype('public.event_status') is null then
    create type public.event_status as enum ('scheduled', 'cancelled', 'completed');
  end if;
end;
$$;

alter table public.profiles add column if not exists guild_role public.guild_role not null default 'member';
-- Uprawnienia z migracji 002 pozwalają edytować tylko pola postaci, nie guild_role.

create or replace function private.is_officer()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_member() and exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and guild_role in ('officer', 'admin')
  );
$$;

create function public.is_guild_officer()
returns boolean language sql stable set search_path = '' as $$
  select private.is_officer();
$$;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text not null default '' check (char_length(description) <= 4000),
  event_type public.event_type not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.event_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.events
  add column if not exists tanks_needed integer not null default 0,
  add column if not exists healers_needed integer not null default 0,
  add column if not exists dps_needed integer not null default 0;
alter table public.events add constraint events_role_targets check (
  tanks_needed between 0 and 80 and healers_needed between 0 and 80 and dps_needed between 0 and 80
  and tanks_needed + healers_needed + dps_needed <= 80
);
-- Zera w dawnych wydarzeniach oznaczają brak określonego celu, nie brak miejsca.

create table if not exists public.event_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.combat_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);

create index if not exists events_schedule_idx on public.events(starts_at) where status = 'scheduled';
create index if not exists events_calendar_idx on public.events(starts_at);
create index if not exists events_creator_idx on public.events(created_by);
create index if not exists rsvps_profile_idx on public.event_rsvps(profile_id);

drop trigger if exists events_updated on public.events;
create trigger events_updated before update on public.events
for each row execute function private.set_updated_at();
drop trigger if exists rsvps_updated on public.event_rsvps;
create trigger rsvps_updated before update on public.event_rsvps
for each row execute function private.set_updated_at();

create function private.check_event_schedule()
returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    if new.starts_at <= now() then
      raise exception 'Nowe wydarzenie musi zaczynać się w przyszłości.' using errcode = '23514';
    end if;
    if new.tanks_needed + new.healers_needed + new.dps_needed = 0 then
      raise exception 'Ustal docelowy skład wydarzenia.' using errcode = '23514';
    end if;
  elsif new.starts_at is distinct from old.starts_at and new.starts_at <= now() then
    raise exception 'Nowy termin musi być w przyszłości.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger event_schedule_valid before insert or update on public.events
for each row execute function private.check_event_schedule();

-- Blokada wiersza synchronizuje zapis z odwołaniem/przesunięciem wydarzenia.
-- Definer jest potrzebny, bo uczestnik nie ma uprawnień UPDATE do events.
create or replace function private.check_rsvp_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  event_row public.events;
begin
  select * into event_row from public.events where id = new.event_id for share;
  if not found or event_row.status <> 'scheduled' or event_row.starts_at <= clock_timestamp() then
    raise exception 'Zapisy na to wydarzenie są zamknięte.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists rsvp_event_open on public.event_rsvps;
create trigger rsvp_event_open before insert or update on public.event_rsvps
for each row execute function private.check_rsvp_event();

-- Upsert zmienia tylko rolę; identyfikatory wydarzenia i gracza są niezmienne.
create function public.save_event_rsvp(p_event_id uuid, p_role public.combat_role)
returns void language sql set search_path = '' as $$
  insert into public.event_rsvps(event_id, profile_id, role)
  values (p_event_id, (select auth.uid()), p_role)
  on conflict (event_id, profile_id) do update set role = excluded.role;
$$;

alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;

drop policy if exists events_read on public.events;
drop policy if exists events_create on public.events;
drop policy if exists events_update on public.events;
drop policy if exists events_delete on public.events;
create policy events_read on public.events for select to authenticated using (private.is_member());
create policy events_create on public.events for insert to authenticated
with check (private.is_officer() and created_by = (select auth.uid()));
create policy events_update on public.events for update to authenticated
using (private.is_officer()) with check (private.is_officer());
create policy events_delete on public.events for delete to authenticated using (private.is_officer());

drop policy if exists rsvps_read on public.event_rsvps;
drop policy if exists rsvps_create on public.event_rsvps;
drop policy if exists rsvps_update on public.event_rsvps;
drop policy if exists rsvps_delete on public.event_rsvps;
create policy rsvps_read on public.event_rsvps for select to authenticated using (private.is_member());
create policy rsvps_create on public.event_rsvps for insert to authenticated
with check (private.is_member() and profile_id = (select auth.uid()));
create policy rsvps_update on public.event_rsvps for update to authenticated
using (private.is_member() and profile_id = (select auth.uid()))
with check (private.is_member() and profile_id = (select auth.uid()));
create policy rsvps_delete on public.event_rsvps for delete to authenticated
using (private.is_member() and profile_id = (select auth.uid()));

revoke all on public.events, public.event_rsvps from public, anon, authenticated;
grant select on public.events, public.event_rsvps to authenticated;
grant insert (created_by, title, description, event_type, starts_at, ends_at, tanks_needed, healers_needed, dps_needed)
  on public.events to authenticated;
grant update (title, description, event_type, starts_at, ends_at, status, tanks_needed, healers_needed, dps_needed)
  on public.events to authenticated;
grant delete on public.events to authenticated;
grant insert (event_id, profile_id, role) on public.event_rsvps to authenticated;
grant update (role) on public.event_rsvps to authenticated;
grant delete on public.event_rsvps to authenticated;

revoke all on function private.check_event_schedule(), private.check_rsvp_event(),
  private.is_officer(), public.is_guild_officer(),
  public.save_event_rsvp(uuid, public.combat_role) from public, anon, authenticated;
grant execute on function private.is_officer(), public.is_guild_officer(),
  public.save_event_rsvp(uuid, public.combat_role) to authenticated;

commit;
