begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.guild_role as enum ('member', 'officer', 'admin');
create type public.combat_role as enum ('tank', 'healer', 'dps');
create type public.event_type as enum ('pvp', 'battleground', 'raid', 'other');
create type public.event_status as enum ('scheduled', 'cancelled', 'completed');
create type public.lfg_activity as enum ('arena', 'battleground', 'mythic_plus', 'raid', 'other');
create type public.lfg_status as enum ('open', 'filled', 'closed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  character_name text check (character_name is null or char_length(btrim(character_name)) between 2 and 24),
  realm text check (realm is null or char_length(btrim(realm)) between 2 and 80),
  race text check (race is null or race = any (array[
    'Human', 'Dwarf', 'Night Elf', 'Gnome', 'Draenei', 'Worgen',
    'Orc', 'Undead', 'Tauren', 'Troll', 'Blood Elf', 'Goblin', 'Pandaren',
    'Dracthyr', 'Void Elf', 'Lightforged Draenei', 'Dark Iron Dwarf', 'Kul Tiran',
    'Mechagnome', 'Nightborne', 'Highmountain Tauren', 'Mag''har Orc',
    'Zandalari Troll', 'Vulpera', 'Earthen'
  ])),
  character_class text check (character_class is null or character_class = any (array[
    'Death Knight', 'Demon Hunter', 'Druid', 'Evoker', 'Hunter', 'Mage', 'Monk',
    'Paladin', 'Priest', 'Rogue', 'Shaman', 'Warlock', 'Warrior'
  ])),
  primary_professions text[] not null default '{}'
    check (
      cardinality(primary_professions) <= 2
      and array_position(primary_professions, null) is null
      and primary_professions <@ array[
        'Alchemy', 'Blacksmithing', 'Enchanting', 'Engineering', 'Herbalism',
        'Inscription', 'Jewelcrafting', 'Leatherworking', 'Mining', 'Skinning', 'Tailoring'
      ]::text[]
      and (cardinality(primary_professions) < 2 or primary_professions[1] <> primary_professions[2])
    ),
  guild_role public.guild_role not null default 'member',
  onboarded_at timestamptz,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint complete_profile check (
    onboarded_at is null or (
      character_name is not null and realm is not null
      and race is not null and character_class is not null
    )
  )
);

create table public.events (
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

create table public.event_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.combat_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);

create table public.lfg_groups (
  id uuid primary key default gen_random_uuid(),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text not null default '' check (char_length(description) <= 4000),
  activity public.lfg_activity not null,
  tanks_needed integer not null default 0 check (tanks_needed between 0 and 40),
  healers_needed integer not null default 0 check (healers_needed between 0 and 40),
  dps_needed integer not null default 1 check (dps_needed between 0 and 40),
  status public.lfg_status not null default 'open',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (status <> 'open' or tanks_needed + healers_needed + dps_needed > 0)
);

create index profiles_class_idx on public.profiles(character_class) where onboarded_at is not null;
create index profiles_race_idx on public.profiles(race) where onboarded_at is not null;
create index profiles_professions_idx on public.profiles using gin(primary_professions);
create index profiles_activity_idx on public.profiles(last_active_at desc) where onboarded_at is not null;
create index events_schedule_idx on public.events(starts_at) where status = 'scheduled';
create index events_creator_idx on public.events(created_by);
create index rsvps_profile_idx on public.event_rsvps(profile_id);
create index lfg_active_idx on public.lfg_groups(expires_at) where status = 'open';
create index lfg_creator_idx on public.lfg_groups(created_by);

create function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated before update on public.profiles
for each row execute function private.set_updated_at();
create trigger events_updated before update on public.events
for each row execute function private.set_updated_at();
create trigger rsvps_updated before update on public.event_rsvps
for each row execute function private.set_updated_at();
create trigger lfg_updated before update on public.lfg_groups
for each row execute function private.set_updated_at();

create function private.create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function private.create_profile();

create function private.is_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = (select auth.uid())
      and p.onboarded_at is not null
      and u.email_confirmed_at is not null
  );
$$;

create function private.is_officer()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_member() and exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and guild_role in ('officer', 'admin')
  );
$$;

create function public.complete_onboarding(
  p_character_name text,
  p_realm text,
  p_race text,
  p_character_class text,
  p_primary_professions text[]
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from auth.users
    where id = (select auth.uid()) and email_confirmed_at is not null
  ) then
    raise exception 'A verified account is required.' using errcode = '42501';
  end if;
  if p_character_name is null or p_realm is null or p_race is null
    or p_character_class is null or p_primary_professions is null
    or coalesce(array_ndims(p_primary_professions), 1) <> 1
    or coalesce(array_lower(p_primary_professions, 1), 1) <> 1 then
    raise exception 'Complete character details are required.' using errcode = '22023';
  end if;
  update public.profiles
  set character_name = btrim(p_character_name),
      realm = btrim(p_realm),
      race = p_race,
      character_class = p_character_class,
      primary_professions = p_primary_professions,
      onboarded_at = coalesce(onboarded_at, now()),
      last_active_at = now()
  where id = (select auth.uid());
  if not found then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;
end;
$$;

create function public.touch_presence()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_member() then
    raise exception 'An onboarded, verified account is required.' using errcode = '42501';
  end if;
  update public.profiles set last_active_at = now()
  where id = (select auth.uid())
    and (last_active_at is null or last_active_at < now() - interval '1 minute');
end;
$$;

create function public.active_players()
returns table (id uuid, character_name text, character_class text, realm text)
language sql stable set search_path = '' as $$
  select p.id, p.character_name, p.character_class, p.realm
  from public.profiles p
  where private.is_member() and p.onboarded_at is not null
    and p.last_active_at between now() - interval '15 minutes' and now()
  order by p.last_active_at desc;
$$;

create function private.check_rsvp_event()
returns trigger language plpgsql set search_path = '' as $$
declare
  event_row public.events;
begin
  select * into event_row from public.events where id = new.event_id for share;
  if not found or event_row.status <> 'scheduled' or event_row.starts_at <= now() then
    raise exception 'Sign-ups are closed for this event.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger rsvp_event_open before insert or update on public.event_rsvps
for each row execute function private.check_rsvp_event();

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.lfg_groups enable row level security;

create policy profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or (private.is_member() and onboarded_at is not null));

create policy events_read on public.events for select to authenticated using (private.is_member());
create policy events_create on public.events for insert to authenticated
with check (private.is_member() and created_by = (select auth.uid()));
create policy events_update on public.events for update to authenticated
using (private.is_member() and (created_by = (select auth.uid()) or private.is_officer()))
with check (private.is_member() and (created_by = (select auth.uid()) or private.is_officer()));
create policy events_delete on public.events for delete to authenticated
using (private.is_member() and (created_by = (select auth.uid()) or private.is_officer()));

create policy rsvps_read on public.event_rsvps for select to authenticated using (private.is_member());
create policy rsvps_create on public.event_rsvps for insert to authenticated
with check (private.is_member() and profile_id = (select auth.uid()));
create policy rsvps_update on public.event_rsvps for update to authenticated
using (private.is_member() and profile_id = (select auth.uid()))
with check (private.is_member() and profile_id = (select auth.uid()));
create policy rsvps_delete on public.event_rsvps for delete to authenticated
using (private.is_member() and profile_id = (select auth.uid()));

create policy lfg_read on public.lfg_groups for select to authenticated using (private.is_member());
create policy lfg_create on public.lfg_groups for insert to authenticated
with check (private.is_member() and created_by = (select auth.uid()));
create policy lfg_update on public.lfg_groups for update to authenticated
using (private.is_member() and (created_by = (select auth.uid()) or private.is_officer()))
with check (private.is_member() and (created_by = (select auth.uid()) or private.is_officer()));
create policy lfg_delete on public.lfg_groups for delete to authenticated
using (private.is_member() and (created_by = (select auth.uid()) or private.is_officer()));

revoke all on public.profiles, public.events, public.event_rsvps, public.lfg_groups from public, anon, authenticated;
grant select on public.profiles, public.events, public.event_rsvps, public.lfg_groups to authenticated;
grant insert (created_by, title, description, event_type, starts_at, ends_at, status) on public.events to authenticated;
grant update (title, description, event_type, starts_at, ends_at, status) on public.events to authenticated;
grant delete on public.events to authenticated;
grant insert (event_id, profile_id, role) on public.event_rsvps to authenticated;
grant update (role) on public.event_rsvps to authenticated;
grant delete on public.event_rsvps to authenticated;
grant insert (created_by, title, description, activity, tanks_needed, healers_needed, dps_needed, status, expires_at) on public.lfg_groups to authenticated;
grant update (title, description, activity, tanks_needed, healers_needed, dps_needed, status, expires_at) on public.lfg_groups to authenticated;
grant delete on public.lfg_groups to authenticated;

revoke all on function private.set_updated_at(), private.create_profile(), private.check_rsvp_event() from public, anon, authenticated;
revoke all on function private.is_member(), private.is_officer() from public, anon, authenticated;
grant execute on function private.is_member(), private.is_officer() to authenticated;
revoke all on function public.complete_onboarding(text, text, text, text, text[]), public.touch_presence(), public.active_players() from public, anon, authenticated;
grant execute on function public.complete_onboarding(text, text, text, text, text[]), public.touch_presence(), public.active_players() to authenticated;

commit;
