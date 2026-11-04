// Glyph names: each hex digit of a portal address is one of the portal's 16 glyphs, and the wiki names each one on
// its own page ("Glyph 1 / 16" is digit 0, "Glyph 16 / 16" is F). The wiki index reads the names from those pages
// into wiki/facts.json; nothing here hard-codes them, and the art itself is never drawn (it's the game's).
import { z } from 'zod';

export const GlyphSchema = z.object({
  digit: z.string().regex(/^[0-9A-F]$/),
  name: z.string().min(1), // the first name the page gives: "Sunset"
  alt: z.string().min(1).optional(), // the second, when it gives two: "Star Over Water"
  path: z.string(), // the glyph's archived page, for a Codex link
  revId: z.int()
});
export type Glyph = z.infer<typeof GlyphSchema>;

export const GlyphTableSchema = z.object({
  page: z.string(), // the wiki's article on glyphs as a whole, which the credit links to
  path: z.string(),
  glyphs: z.array(GlyphSchema).length(16)
});
export type GlyphTable = z.infer<typeof GlyphTableSchema>;

/** The hex digit a glyph page stands for: "Glyph 1 / 16" → "0", "Glyph 16 / 16" → "F". */
export function glyphPageDigit(title: string): string | null {
  const match = /^Glyph (\d{1,2}) \/ 16$/.exec(title.trim());
  const n = match ? Number(match[1]) : 0;
  return n >= 1 && n <= 16 ? (n - 1).toString(16).toUpperCase() : null;
}

// "[[The Atlas|Atlas]]" reads "Atlas"; "[[Tent]]" reads "Tent".
const unlink = (text: string) => text.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1');

/**
 * The names a glyph page gives: "This glyph can be referred to as either Sunset or Star Over Water." or "This glyph
 * is referred to as Tent." Null when the page no longer says it that way.
 */
export function parseGlyphNames(body: string): { name: string; alt?: string } | null {
  const line = /This glyph (?:can be|is) referred to as (.+)/.exec(unlink(body))?.[1];
  if (!line) return null;
  const text = line.split('\n')[0]?.trim().replace(/\.$/, '') ?? '';
  const either = /^either (.+?) or (.+)$/.exec(text);
  const [name, alt] = either ? [either[1]?.trim(), either[2]?.trim()] : [text, undefined];
  if (!name) return null;
  return alt ? { name, alt } : { name };
}

/** Each character of a portal address with its glyph, in dialling order; null if any character isn't a glyph. */
export function glyphNames(address: string, table: GlyphTable | null): Glyph[] | null {
  if (!table || !address) return null;
  const byDigit = new Map(table.glyphs.map(glyph => [glyph.digit, glyph]));
  const out: Glyph[] = [];
  for (const char of address.toUpperCase()) {
    const glyph = byDigit.get(char);
    if (!glyph) return null;
    out.push(glyph);
  }
  return out;
}
