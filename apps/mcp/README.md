# nms-atlas-mcp

**ATLAS for AI assistants.** A local, read-only [MCP](https://modelcontextprotocol.io) server for No Man's Sky. Your AI assistant (Claude Desktop, Claude Code, or any MCP client) can answer from:

- **A verified mirror of the No Man's Sky Wiki:** search and read articles, plan a craft (what to gather, then each crafting round), value items, and the game rules the wiki states (supercharged slots per class, inventory grid sizes). Every answer links to its wiki page and revision.
- **Your own [ATLAS](https://atlas-os.cloud) log, if you connect it:** your systems and planets, outlaw stations ready to run, ships and Multi-Tools, notes and timers.

It runs on your computer and only reads. It never changes your log.

## Install
Needs Node.js 20 or newer. Quit Claude Desktop, then add this to its config file, `claude_desktop_config.json` (on macOS in `~/Library/Application Support/Claude/`, on Windows in `%APPDATA%\Claude\`), keeping anything already in it:

```json
{
  "mcpServers": {
    "atlas": {
      "command": "npx",
      "args": ["-y", "nms-atlas-mcp"],
      "env": { "ATLAS_SYNC_CODE": "your sync code" }
    }
  }
}
```

Desktop apps start the server with the system's search path, so the `node` it finds must be 20 or newer. If you use nvm, or have an older Node installed too, add that Node's folder to the server's `PATH` in `env`, first. In a terminal where `node --version` says 20 or newer, `dirname "$(which node)"` prints the folder:

```json
"env": {
  "ATLAS_SYNC_CODE": "your sync code",
  "PATH": "/Users/you/.nvm/versions/node/v24.22.0/bin:/usr/bin:/bin"
}
```

For Claude Code: `claude mcp add atlas -e ATLAS_SYNC_CODE=… -- npx -y nms-atlas-mcp`

Then ask, for example: "What do I need to craft 3 Warp Cells?", "Which of my outlaw stations are ready?", "Does my Multi-Tool's layout match the wiki's rules?"

## Your log
- **`ATLAS_SYNC_CODE`:** the code from ATLAS → More → Sync → Show the code. The server fetches your encrypted synced copy and opens it on your computer, as a paired device does; the sync server only ever sees ciphertext.
- **`ATLAS_STATE_FILE`:** the path to an exported log file (More → Your data → Export). Nothing is fetched.
- **Neither:** the game tools still work.

**Before you paste the code:** it's the key to your whole log. Anything holding it can read and change the log through the sync server. This server only reads, but the code sits in your client's config file. If you'd rather not, use an exported file.

**What you ask about goes to your AI provider:** when the assistant calls a tool about your log, the answer goes to the model you use, under that provider's terms.

## Game data
On first run the server downloads the wiki data (about 10 MB) from ATLAS's site and keeps it in your cache folder (`~/Library/Caches/nms-atlas-mcp`, `%LOCALAPPDATA%\nms-atlas-mcp` or `~/.cache/nms-atlas-mcp`). Once a day it checks the site for a newer copy, which the next run uses. Nothing about you is sent with these requests.

| Setting | Meaning |
|---|---|
| `ATLAS_SYNC_CODE` | Your sync code (or the pairing link). |
| `ATLAS_STATE_FILE` | An exported log file. |
| `ATLAS_CACHE_DIR` | Another cache folder. |
| `ATLAS_WIKI_DIR` | Use a local wiki folder instead of downloading (a clone of the repo after `pnpm index:wiki`). |
| `ATLAS_SYNC_URL` | Another sync server (https). |

## License
MIT. The wiki text it serves is CC BY-NC-SA 3.0, from the [No Man's Sky Wiki](https://nomanssky.fandom.com) contributors. ATLAS is a fan project, not affiliated with Hello Games. Source and docs: https://github.com/Relmaur/atlas-os
