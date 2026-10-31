# Updates

The named updates players read at https://atlas-os.cloud/updates/. `CHANGELOG.md` stays the developer record.

One file per update: `<yyyy-mm-dd>-<slug>.md`, with everything in its frontmatter (`packages/core/src/updates.ts` says
which fields there are). The build writes the list, a page per update and the feed from these files, and the app's
"What's new" card reads the newest one. A new file is what makes a new card appear: patch fixes roll into the next update.

- Write for Travellers, not developers. Names are short and evocative, and never the game's own update names.
- `{{wikiPages}}` is replaced with the count at build time.
- `banner` is 1600×800, shown on the page and used when a link is shared. `share` is the same without showing it.
  Make them from the real app with `scripts/site-banners.mjs`.
