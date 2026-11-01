# How the build prompt applies here

`docs/process/build-prompt.md` is the development protocol for every change: the scope and complexity gates first, the graph for non-trivial work, the policy gates always. This page records which parts bind this project today, and what would change that. Re-read it whenever a change adds a server, accounts, third-party calls, or data leaving the device.

What leaves the device today, each opt-in or player-started (`AGENTS.md`, Invariants):
- **Export:** a file the player saves (ADR-0002).
- **Sync:** a copy of the log sealed on the device, stored by the relay Worker in `apps/sync`, which can't open it (ADR-0005).
- **Push alerts:** with "Alerts when the app is asleep" on, the device's push subscription plus its running timers' random ids and end times; each push carries only a timer id, and the device writes the notification from text it kept (ADR-0006).
- **MCP server:** when the player sets it up on their computer, tool answers from their log go to the AI client they chose, and from there to that client's model provider (ADR-0008). It only reads.

| Harness layer | Applies? | How it applies today | Re-evaluate when |
|---|---|---|---|
| Context engine (`AGENTS.md`, `docs/STATE.md`) | Yes | `AGENTS.md` holds invariants only; `docs/STATE.md` is updated before any non-trivial task ends. | Always applies. |
| Schema guard | Yes | Zod schemas in `@atlas/core` and `@atlas/wiki`: state files (import, `localStorage`, `nms_state.json`), `game-data.json` in the calculators, wiki API payloads and article frontmatter in the sync. The relay parses push requests (`apps/sync/src/push.ts`); vault bodies are opaque sealed bytes, checked only for size. Not yet: the Codex's `index.json` and offline bundle (see `docs/STATE.md`). | New external input or payload. |
| Failure mode & retry guard | Yes | Wiki dump: a malformed page or a dump of another wiki stops the sync before anything is written. Browser: timeouts on fetches, visible save-failure banner, multi-tab reload. Sync: compare-and-swap versions, so a stale copy never overwrites a newer one. Relay: push sends time out after 5 s and failures are retried; a gone subscription (404/410) is dropped. | New I/O boundary. |
| Context pruning | Yes (process) | Long sessions compact into `docs/STATE.md` and commit messages. | — |
| PII scrubbing | Partly | Sync: the relay holds only sealed bytes, a token hash and a version; it never logs ids, tokens or bodies (`apps/sync/src/handler.ts`). Push: no timer names or notes reach the relay. Diagnostics: one `[atlas]` line per event, never user content. MCP: answers are not redacted. The player's own log goes to the AI client they configured, by design and as `docs/mcp.md` warns; ATLAS calls no model itself. | Accounts, analytics, error reporting, or any feature where ATLAS itself sends user text to a third party. |
| Zero-retention & TTL | Yes (relay) | A daily purge (04:23 UTC) deletes vaults unused for a year (a read counts as use) and push devices silent for 60 days. A delivered push's row is deleted; past-due rows are pruned. The player can delete their vault. `/v1/status` reports aggregate counts only. Worker logs are off (`[observability] enabled = false`). Cloudflare's own request logs fall under its terms, not ours. | A new stored field, a new store, or a change to the purge. |
| Abuse controls | Yes (relay) | Per-client rate limits keyed by IPv4 address or IPv6 /64: 60 requests a minute, 3 new vaults and 4 push schedules a minute (`apps/sync/wrangler.toml`). Bodies capped while they stream in: 256 KB per vault, 16 KB per push request, 20 timers kept per device. CORS limited to the site and local dev. A missing limiter binding lets requests through (see `docs/STATE.md`). A capacity meter turns new players away at 80% of the plan's daily limits and answers everyone "full until midnight UTC" at 95%; no new vaults once storage is 90% full. The MCP server is local over stdio and opens no port. | A new endpoint, a raised cap, or a plan change. |

## Policy gates in this project
- **Destructive action:** deleting committed files outside the wiki mirror's own sync, dropping user-state keys, or rewriting git history needs explicit approval. The wiki sync may rewrite mirrored `.md` files; it never deletes them (removed pages are flagged).
- **Major release:** anything that breaks a saved `nms_state.json`, an exported file, a URL users bookmark (`#section`, `wiki/#/a/<path>`), or a supported way of running the app is a MAJOR bump and needs approval.
- **Data privacy:** any change to where user state is stored or sent (sync, push, the MCP server's answers, accounts, analytics) halts for review and gets an ADR.
- **Public surface:** renaming the product, the npm package (`nms-atlas-mcp`), the URL (`atlas-os.cloud`) or the PWA identity (manifest name and id), and publishing a package, need the owner's yes.
- **Firewall:** nothing from the owner's private notes enters the repo, commits, issues, PRs or ADRs.
