-- Uruchom ten plik raz w SQL Editor jako postgres.
-- Działa zarówno w pustym projekcie, jak i po starej migracji 001.
-- Nie usuwa kont, danych postaci ani istniejących wydarzeń/grup.
begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Supabase sam zarządza auth.users, adresami e-mail i hasłami.
-- Jedyna tabela wymagana przez obecną aplikację:
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  character_name text check (
    character_name is null or char_length(btrim(character_name)) between 2 and 24
  ),
  realm text check (
    realm is null or char_length(btrim(realm)) between 2 and 80
  ),
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
  primary_professions text[] not null default '{}' check (
    cardinality(primary_professions) <= 2
    and coalesce(array_ndims(primary_professions), 1) = 1
    and coalesce(array_lower(primary_professions, 1), 1) = 1
    and array_position(primary_professions, null) is null
    and primary_professions <@ array[
      'Alchemy', 'Blacksmithing', 'Enchanting', 'Engineering', 'Herbalism',
      'Inscription', 'Jewelcrafting', 'Leatherworking', 'Mining', 'Skinning', 'Tailoring'
    ]::text[]
    and (cardinality(primary_professions) < 2 or primary_professions[1] <> primary_professions[2])
  ),
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Jedyny warunek członkostwa: zalogowane konto z potwierdzonym e-mailem.
create or replace function private.is_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users
    where id = (select auth.uid()) and email_confirmed_at is not null
  );
$$;

create or replace function public.active_players()
returns table (id uuid, character_name text, character_class text, realm text)
language sql stable set search_path = '' as $$
  select p.id, p.character_name, p.character_class, p.realm
  from public.profiles p
  where private.is_member()
    and p.last_active_at between now() - interval '15 minutes' and now()
  order by p.last_active_at desc;
$$;

-- Usunięcie starego wymogu onboardingu, bez usuwania danych postaci.
drop policy if exists profiles_read on public.profiles;
drop function if exists public.complete_onboarding(text, text, text, text, text[]);
alter table public.profiles drop constraint if exists complete_profile;
alter table public.profiles drop column if exists onboarded_at;

alter table public.profiles drop constraint if exists profiles_professions_shape;
alter table public.profiles add constraint profiles_professions_shape check (
  coalesce(array_ndims(primary_professions), 1) = 1
  and coalesce(array_lower(primary_professions, 1), 1) = 1
);

create index if not exists profiles_recent_activity_idx
  on public.profiles(last_active_at desc);

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_updated on public.profiles;
create trigger profiles_updated before update on public.profiles
for each row execute function private.set_updated_at();

create or replace function private.create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.create_profile();

-- Obsługa kont założonych jeszcze przed uruchomieniem migracji.
insert into public.profiles(id)
select id from auth.users
on conflict (id) do nothing;

create or replace function public.touch_presence()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_member() then
    raise exception 'Wymagane jest konto z potwierdzonym adresem e-mail.'
      using errcode = '42501';
  end if;
  update public.profiles set last_active_at = now()
  where id = (select auth.uid())
    and (last_active_at is null or last_active_at < now() - interval '1 minute');
  if not exists (select 1 from public.profiles where id = (select auth.uid())) then
    raise exception 'Nie znaleziono profilu.' using errcode = 'P0002';
  end if;
end;
$$;

alter table public.profiles enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or private.is_member());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
using (id = (select auth.uid()) and private.is_member())
with check (id = (select auth.uid()) and private.is_member());

revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
-- Brak możliwości zmiany id, roli gildii i znaczników czasu przez klienta.
grant update (character_name, realm, race, character_class, primary_professions)
  on public.profiles to authenticated;

revoke all on function private.create_profile(), private.set_updated_at(),
  private.is_member(), public.touch_presence(), public.active_players()
  from public, anon, authenticated;
grant execute on function private.is_member(), public.touch_presence(),
  public.active_players() to authenticated;

commit;
