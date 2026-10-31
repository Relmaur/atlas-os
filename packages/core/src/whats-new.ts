// The app's "What's new" card: what it carries of the newest update, and when it shows. Apart from updates.ts so the app
// doesn't bundle a YAML parser.
import { z } from 'zod';

export const LatestUpdateSchema = z.object({
  slug: z.string(),
  name: z.string(),
  title: z.string(),
  text: z.string()
});
export type LatestUpdate = z.infer<typeof LatestUpdateSchema>;

// Once per update, never on a first install. An empty log with nothing recorded is someone new: they've nothing to be
// updated from, so the current update is simply marked as seen. A log with nothing recorded came from before the card.
export function whatsNew(
  latest: string | null,
  seen: string | null,
  emptyLog: boolean
): 'nothing' | 'show' | 'mark-seen' {
  if (!latest || seen === latest) return 'nothing';
  return emptyLog ? 'mark-seen' : 'show';
}
