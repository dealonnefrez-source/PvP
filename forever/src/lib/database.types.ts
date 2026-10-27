import type { CHARACTER_CLASSES, PROFESSIONS, RACES } from "./wow";

export type GuildRole = "member" | "officer" | "admin";
export type CombatRole = "tank" | "healer" | "dps";

export type Profile = {
  id: string;
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

// Minimal schema from migration 002; legacy event tables are not required.
export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, never, Partial<Pick<Profile, "character_name" | "realm" | "race" | "character_class" | "primary_professions">>>;
    };
    Views: Record<string, never>;
    Functions: {
      touch_presence: { Args: Record<string, never>; Returns: undefined };
      active_players: {
        Args: Record<string, never>;
        Returns: { id: string; character_name: string | null; character_class: (typeof CHARACTER_CLASSES)[number] | null; realm: string | null }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
