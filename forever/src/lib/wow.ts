export const CHARACTER_CLASSES = [
  "Death Knight", "Demon Hunter", "Druid", "Evoker", "Hunter", "Mage", "Monk",
  "Paladin", "Priest", "Rogue", "Shaman", "Warlock", "Warrior",
] as const;

export const CLASS_LABELS: Record<(typeof CHARACTER_CLASSES)[number], string> = {
  "Death Knight": "Rycerz śmierci",
  "Demon Hunter": "Łowca demonów",
  Druid: "Druid",
  Evoker: "Przywoływacz",
  Hunter: "Łowca",
  Mage: "Mag",
  Monk: "Mnich",
  Paladin: "Paladyn",
  Priest: "Kapłan",
  Rogue: "Łotrzyk",
  Shaman: "Szaman",
  Warlock: "Czarnoksiężnik",
  Warrior: "Wojownik",
};

export const RACES = [
  "Human", "Dwarf", "Night Elf", "Gnome", "Draenei", "Worgen",
  "Orc", "Undead", "Tauren", "Troll", "Blood Elf", "Goblin", "Pandaren",
  "Dracthyr", "Void Elf", "Lightforged Draenei", "Dark Iron Dwarf",
  "Kul Tiran", "Mechagnome", "Nightborne", "Highmountain Tauren",
  "Mag'har Orc", "Zandalari Troll", "Vulpera", "Earthen",
] as const;

export const PROFESSIONS = [
  "Alchemy", "Blacksmithing", "Enchanting", "Engineering", "Herbalism",
  "Inscription", "Jewelcrafting", "Leatherworking", "Mining", "Skinning", "Tailoring",
] as const;

export const RACE_LABELS: Record<(typeof RACES)[number], string> = {
  Human: "Człowiek",
  Dwarf: "Krasnolud",
  "Night Elf": "Nocny elf",
  Gnome: "Gnom",
  Draenei: "Draenei",
  Worgen: "Worgen",
  Orc: "Ork",
  Undead: "Nieumarły",
  Tauren: "Tauren",
  Troll: "Troll",
  "Blood Elf": "Krwawy elf",
  Goblin: "Goblin",
  Pandaren: "Pandaren",
  Dracthyr: "Dracthyr",
  "Void Elf": "Elf Pustki",
  "Lightforged Draenei": "Draenei wykuty w Światłości",
  "Dark Iron Dwarf": "Krasnolud Ciemnego Żelaza",
  "Kul Tiran": "Kul Tirańczyk",
  Mechagnome: "Mechagnom",
  Nightborne: "Zrodzony z Nocy",
  "Highmountain Tauren": "Tauren z Wysokiej Góry",
  "Mag'har Orc": "Ork Mag'har",
  "Zandalari Troll": "Troll zandalarski",
  Vulpera: "Vulpera",
  Earthen: "Ziemny",
};

export const PROFESSION_LABELS: Record<(typeof PROFESSIONS)[number], string> = {
  Alchemy: "Alchemia",
  Blacksmithing: "Kowalstwo",
  Enchanting: "Zaklinanie",
  Engineering: "Inżynieria",
  Herbalism: "Zielarstwo",
  Inscription: "Inskrypcja",
  Jewelcrafting: "Jubilerstwo",
  Leatherworking: "Kuśnierstwo",
  Mining: "Górnictwo",
  Skinning: "Skórowanie",
  Tailoring: "Krawiectwo",
};
