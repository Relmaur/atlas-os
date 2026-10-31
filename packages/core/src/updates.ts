// The named updates players read (updates/*.md): one Markdown file per update, all of it in the frontmatter. The site
// build writes the pages and feed from them, and the app's "What's new" card reads the newest.
import { parse } from 'yaml';
import { z } from 'zod';
import type { LatestUpdate } from './whats-new.ts';

const VersionSchema = z.string().regex(/^\d+\.\d+/);
export const UPDATE_ICONS = ['map', 'card', 'runs', 'codex', 'log', 'timers'] as const;

export const UpdateSchema = z
  .object({
    name: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dateLabel: z.string().optional(), // when a plain date would claim too much ("Before 27 Oct 2026")
    versions: z.string().min(1),
    chip: z.string().optional(), // what the version chip says, when it isn't the whole range
    coversFrom: VersionSchema,
    coversTo: VersionSchema,
    lede: z.string().min(1),
    banner: z.string().optional(), // shown on the page, and the share image
    alt: z.string().optional(),
    caption: z.string().optional(),
    share: z.string().optional(), // a share image that isn't shown on the page
    highlights: z.array(z.object({ title: z.string(), icon: z.enum(UPDATE_ICONS), text: z.string() })).min(1),
    also: z.array(z.string()).default([]),
    notes: z.array(z.object({ title: z.string(), text: z.string() })).default([])
  })
  .refine(update => Boolean(update.banner ?? update.share), 'An update needs a banner or a share image')
  .refine(update => !update.banner || Boolean(update.alt), 'A banner needs alt text');
export type Update = z.infer<typeof UpdateSchema>;

const FRONTMATTER = /^---\n([\s\S]*?)\n---/;

// `vars` fills placeholders such as {{wikiPages}}, so a number in the copy can't drift from the data. It runs before the
// YAML is read, and a placeholder left over is an error rather than something a player would see.
export function parseUpdate(text: string, vars: Record<string, string> = {}): Update {
  const block = FRONTMATTER.exec(text)?.[1];
  if (!block) throw new Error('An update needs frontmatter');
  const filled = block.replace(/\{\{(\w+)\}\}/g, (whole, name: string) => {
    const value = vars[name];
    if (value === undefined) throw new Error(`Unknown placeholder ${whole}`);
    return value;
  });
  return UpdateSchema.parse(parse(filled, { schema: 'core', version: '1.2' }));
}

export const newestFirst = (updates: Update[]): Update[] => [...updates].sort((a, b) => b.date.localeCompare(a.date));

export const latestOf = (updates: Update[]): LatestUpdate | null => {
  const update = newestFirst(updates)[0];
  const first = update?.highlights[0];
  return update && first ? { slug: update.slug, name: update.name, title: first.title, text: first.text } : null;
};
