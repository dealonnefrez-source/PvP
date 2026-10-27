-- Uruchom po migracji 003. Zachowuje konta, profile, wydarzenia i zapisy.
begin;

do $$
begin
  if to_regtype('public.guild_role') is null then
    create type public.guild_role as enum ('member', 'officer', 'guild_master');
  elsif exists (
    select 1 from pg_enum
    where enumtypid = 'public.guild_role'::regtype and enumlabel = 'admin'
  ) then
    alter type public.guild_role rename value 'admin' to 'guild_master';
  end if;
end;
$$;

alter table public.profiles add column if not exists guild_role public.guild_role not null default 'member';

create or replace function private.is_officer()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_member() and exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and guild_role in ('officer', 'guild_master')
  );
$$;

-- Tylko to RPC może zmienić rolę z aplikacji. Brak uprawnień UPDATE guild_role.
create function public.set_guild_role(p_profile_id uuid, p_role public.guild_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Blokada wiersza chroni przed zmianą uprawnień w trakcie tej operacji.
  perform 1 from public.profiles
  where id = (select auth.uid()) and guild_role in ('officer', 'guild_master')
  for update;
  if not found or not private.is_member() then
    raise exception 'Tylko oficer lub mistrz gildii może zmieniać role.' using errcode = '42501';
  end if;
  update public.profiles set guild_role = p_role where id = p_profile_id;
  if not found then
    raise exception 'Nie znaleziono gracza.' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.set_guild_role(uuid, public.guild_role) from public, anon, authenticated;
grant execute on function public.set_guild_role(uuid, public.guild_role) to authenticated;

drop policy events_create on public.events;
create policy events_create on public.events for insert to authenticated
with check (private.is_member() and created_by = (select auth.uid()));
drop policy events_update on public.events;
create policy events_update on public.events for update to authenticated
using (private.is_member() and (created_by = (select auth.uid()) or private.is_officer()))
with check (private.is_member() and (created_by = (select auth.uid()) or private.is_officer()));
drop policy events_delete on public.events;
create policy events_delete on public.events for delete to authenticated
using (private.is_member() and (created_by = (select auth.uid()) or private.is_officer()));

create or replace function private.check_event_schedule()
returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    if new.starts_at <= now() then
      raise exception 'Nowe wydarzenie musi zaczynać się w przyszłości.' using errcode = '23514';
    end if;
  elsif new.starts_at is distinct from old.starts_at and new.starts_at <= now() then
    raise exception 'Nowy termin musi być w przyszłości.' using errcode = '23514';
  end if;
  return new;
end;
$$;
alter table public.events alter column event_type set default 'other';

commit;
