export type GuildRole = "member" | "officer" | "admin";
export type CombatRole = "tank" | "healer" | "dps";

export type Profile = {
  id: string;
  character_name: string | null;
  realm: string | null;
  race: (typeof RACES)[number] | null;
  character_class: (typeof CHARACTER_CLASSES)[number] | null;
  primary_professions: (typeof PROFESSIONS)[number][];
  guild_role: GuildRole;
  onboarded_at: string | null;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
};

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type Event = {
  id: string;
  created_by: string | null;
  title: string;
  description: string;
  event_type: "pvp" | "battleground" | "raid" | "other";
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "cancelled" | "completed";
  created_at: string;
  updated_at: string;
};

type LfgGroup = {
  id: string;
  created_by: string | null;
  title: string;
  description: string;
  activity: "arena" | "battleground" | "mythic_plus" | "raid" | "other";
  tanks_needed: number;
  healers_needed: number;
  dps_needed: number;
  status: "open" | "filled" | "closed";
  expires_at: string;
  created_at: string;
  updated_at: string;
};

type Generated = "id" | "created_at" | "updated_at";
type EventInsert = Omit<Event, Generated | "created_by" | "description" | "status"> &
  Partial<Pick<Event, Generated | "created_by" | "description" | "status">>;
type LfgInsert = Omit<LfgGroup, Generated | "created_by" | "description" | "status" | "tanks_needed" | "healers_needed" | "dps_needed"> &
  Partial<Pick<LfgGroup, Generated | "created_by" | "description" | "status" | "tanks_needed" | "healers_needed" | "dps_needed">>;
type Rsvp = { event_id: string; profile_id: string; role: CombatRole; created_at: string; updated_at: string };

// Matches the initial migration. Regenerate from Supabase after applying schema changes.
export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, never, never>;
      events: Table<Event, EventInsert>;
      event_rsvps: Table<Rsvp, Omit<Rsvp, "created_at" | "updated_at"> & Partial<Pick<Rsvp, "created_at" | "updated_at">>>;
      lfg_groups: Table<LfgGroup, LfgInsert>;
    };
    Views: Record<string, never>;
    Functions: {
      complete_onboarding: {
        Args: { p_character_name: string; p_realm: string; p_race: string; p_character_class: string; p_primary_professions: string[] };
        Returns: undefined;
      };
      touch_presence: { Args: Record<string, never>; Returns: undefined };
      active_players: {
        Args: Record<string, never>;
        Returns: { id: string; character_name: string; character_class: (typeof CHARACTER_CLASSES)[number]; realm: string }[];
      };
    };
    Enums: {
      guild_role: GuildRole;
      combat_role: CombatRole;
      event_type: Event["event_type"];
      event_status: Event["status"];
      lfg_activity: LfgGroup["activity"];
      lfg_status: LfgGroup["status"];
    };
    CompositeTypes: Record<string, never>;
  };
};
import type { CHARACTER_CLASSES, PROFESSIONS, RACES } from "./wow";
