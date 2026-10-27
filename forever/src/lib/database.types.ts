import type { CHARACTER_CLASSES, PROFESSIONS, RACES } from "./wow";

export type GuildRole = "member" | "officer" | "guild_master";
export type CombatRole = "tank" | "healer" | "dps";

export type Profile = {
  id: string;
  guild_role: GuildRole;
  character_name: string | null;
  realm: string | null;
  race: (typeof RACES)[number] | null;
  character_class: (typeof CHARACTER_CLASSES)[number] | null;
  primary_professions: (typeof PROFESSIONS)[number][];
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

export type GuildEvent = {
  id: string;
  created_by: string | null;
  title: string;
  description: string;
  event_type: "pvp" | "battleground" | "raid" | "other";
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "cancelled" | "completed";
  tanks_needed: number;
  healers_needed: number;
  dps_needed: number;
  created_at: string;
  updated_at: string;
};
export type EventRsvp = {
  event_id: string;
  profile_id: string;
  role: CombatRole;
  created_at: string;
  updated_at: string;
};
type EventInput = Pick<GuildEvent, "created_by" | "title" | "description" | "event_type" | "starts_at" | "ends_at" | "tanks_needed" | "healers_needed" | "dps_needed">;

// Schema after migrations 002, 003 and 004.
export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, never, Partial<Pick<Profile, "character_name" | "realm" | "race" | "character_class" | "primary_professions">>>;
      events: Table<GuildEvent, EventInput, Partial<Omit<EventInput, "created_by">> & { status?: GuildEvent["status"] }>;
      event_rsvps: Table<EventRsvp, Pick<EventRsvp, "event_id" | "profile_id" | "role">, Pick<EventRsvp, "role">>;
    };
    Views: Record<string, never>;
    Functions: {
      is_guild_officer: { Args: Record<string, never>; Returns: boolean };
      set_guild_role: { Args: { p_profile_id: string; p_role: GuildRole }; Returns: undefined };
      save_event_rsvp: { Args: { p_event_id: string; p_role: CombatRole }; Returns: undefined };
      touch_presence: { Args: Record<string, never>; Returns: undefined };
      active_players: {
        Args: Record<string, never>;
        Returns: { id: string; character_name: string | null; character_class: (typeof CHARACTER_CLASSES)[number] | null; realm: string | null }[];
      };
    };
    Enums: {
      guild_role: GuildRole;
      combat_role: CombatRole;
      event_type: GuildEvent["event_type"];
      event_status: GuildEvent["status"];
    };
    CompositeTypes: Record<string, never>;
  };
};
