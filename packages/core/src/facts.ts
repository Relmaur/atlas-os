// Cited facts (ADR-0003): rules the wiki states in prose, not in an infobox, turned into data only together with the
// sentence that says so. The wiki sync defines them (packages/wiki/src/facts.ts), checks each quote against its
// archived page, and writes the ones it found to wiki/facts.json. A fact whose quote is gone is left out of that
// file, so nothing here ever applies a rule the mirror can no longer show.
import { z } from 'zod';
import { GlyphTableSchema } from './glyphs.ts';
import { PlanetFactsSchema, biomeFor } from './planets.ts';
import { GalaxyMapFactsSchema } from './galaxy-map.ts';

export const ClassCountsSchema = z.object({ C: z.int(), B: z.int(), A: z.int(), S: z.int() });
// Technology inventory maximums, in slots, by class; `any` when the wiki gives one number for every class.
export const TechMaxSchema = z.object({
  columns: z.int().positive(),
  slots: z.partialRecord(z.enum(['C', 'B', 'A', 'S', 'any']), z.int().positive())
});
const SlotListSchema = z.array(z.string().regex(/^R\d{1,2}C\d{1,2}$/));
// The planet marker's colour families. A biome joins one only where the wiki says what it's like (its hazard, or
// that it's Earth-like or exotic); every other biome draws slate.
export const BIOME_FAMILIES = ['toxic', 'hot', 'radioactive', 'frozen', 'exotic', 'lush'] as const;
export type BiomeFamily = (typeof BIOME_FAMILIES)[number];
const BiomeFamilySchema = z.object({ biome: z.string(), family: z.enum(BIOME_FAMILIES) });

// The shape of each fact's value, by id. A fact the sync defines must match its schema here (a unit test checks).
export const FACT_VALUES = {
  'supercharged-per-class': ClassCountsSchema,
  'supercharged-fixed-count': z.int().positive(),
  'exosuit-supercharged-slots': SlotListSchema,
  'multitool-tech-max': TechMaxSchema,
  'starship-tech-max': TechMaxSchema,
  'exosuit-tech-max': TechMaxSchema,
  'biome-lush': BiomeFamilySchema,
  'biome-scorched': BiomeFamilySchema,
  'biome-volcanic': BiomeFamilySchema,
  'biome-frozen': BiomeFamilySchema,
  'biome-toxic': BiomeFamilySchema,
  'biome-irradiated': BiomeFamilySchema,
  'biome-exotic': BiomeFamilySchema,
  'biome-mega-exotic': BiomeFamilySchema,
  'biome-gas-giant': BiomeFamilySchema,
  // Light years per region (one step of a portal address's X, Y or Z): distances from a galaxy's centre.
  'region-light-years': z.int().positive()
} as const;
export type FactId = keyof typeof FACT_VALUES;
export type FactValue<Id extends FactId> = z.infer<(typeof FACT_VALUES)[Id]>;

export const CitedFactSchema = z.object({
  page: z.string(), // the wiki page's title
  path: z.string(), // its archived copy, for a Codex link
  url: z.string(),
  revId: z.int(),
  quote: z.string(),
  value: z.unknown()
});
export type CitedFact = z.infer<typeof CitedFactSchema>;

// The game version the mirror describes: the wiki's newest Update page. Runs say what they were checked against with
// it, and a run that relied on a value an update changed is retired.
export const GameVersionSchema = z.object({
  version: z.string(), // "7.10"
  page: z.string(), // "Update 7.10"
  path: z.string(),
  url: z.string(),
  date: z.string() // as the page writes it: "28 October, 2026"
});
export type GameVersion = z.infer<typeof GameVersionSchema>;

export const FactsFileSchema = z.object({
  schema: z.literal(1),
  facts: z.record(z.string(), CitedFactSchema),
  game: GameVersionSchema.optional(), // added in the redesign; an older file has none
  glyphs: GlyphTableSchema.optional(), // the portal glyphs' names; an older file has none
  planets: PlanetFactsSchema.optional(), // biomes, weather, sentinel and life words for the planet editor
  galaxyMap: GalaxyMapFactsSchema.optional() // spectral classes and economy words for the system editor
});
export type FactsFile = z.infer<typeof FactsFileSchema>;

// The fact and its typed value, or null when it is missing or its value no longer has the expected shape.
export function getFact<Id extends FactId>(
  file: FactsFile | null,
  id: Id
): { fact: CitedFact; value: FactValue<Id> } | null {
  const fact = file?.facts[id];
  if (!fact) return null;
  const parsed = FACT_VALUES[id].safeParse(fact.value);
  // The schema for `id` produces FactValue<id>; TypeScript can't narrow the union of schemas by a generic key.
  return parsed.success ? { fact, value: parsed.data as FactValue<Id> } : null;
}

const BIOME_FACTS = [
  'biome-lush',
  'biome-scorched',
  'biome-volcanic',
  'biome-frozen',
  'biome-toxic',
  'biome-irradiated',
  'biome-exotic',
  'biome-mega-exotic',
  'biome-gas-giant'
] as const;

/** A biome's colour family ("Scorched" → "hot"), from the cited facts; null when the wiki gives it none. */
export function biomeFamily(file: FactsFile | null, biome: string): BiomeFamily | null {
  // A prefix only one biome uses reads as that biome ("Frostbound" → Frozen); the stored text stays as typed.
  const wanted = (biomeFor(file?.planets ?? null, biome)?.name ?? biome).trim().toLowerCase();
  if (!wanted) return null;
  for (const id of BIOME_FACTS) {
    const value = getFact(file, id)?.value;
    if (value?.biome.toLowerCase() === wanted) return value.family;
  }
  return null;
}
