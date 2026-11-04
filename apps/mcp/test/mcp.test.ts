// The MCP server end to end: an in-memory MCP client calls each tool against the real wiki mirror (run
// `pnpm index:wiki` after a fresh clone) and a test log; the log loader against a fake relay and a file.
import { beforeAll, expect, test } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { deriveSyncKeys, newSyncCode, sealState } from '@atlas/core/sync-crypto';
import { buildState, type AppState } from '@atlas/core/state';
import { createServer, type Deps } from '../src/tools.ts';
import { loadWiki, type Wiki } from '../src/wiki.ts';
import { CACHE_MS, LogError, logSourceFromEnv, makeLogLoader } from '../src/log.ts';

const NOW = Date.parse('2026-10-27T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

const LOG = {
  systems: [
    {
      id: 'sys-1',
      name: 'Vela Drift',
      galaxy: 'Euclid',
      glyphs: '21A4F03A0E10',
      tags: ['outlaw'],
      visits: [{ at: hoursAgo(30), packets: 15 }],
      planets: [{ id: 'p-1', name: 'Kesh', biome: 'Toxic', tags: [], notes: 'Storm crystals' }]
    },
    { id: 'sys-2', name: 'Harrow Gate', tags: ['outlaw'], visits: [{ at: hoursAgo(2), packets: 15 }] },
    { id: 'sys-3', name: 'Quiet Reach', tags: ['trade'], notes: 'Good economy' }
  ],
  gear: [
    { id: 'g-1', kind: 'multitool', name: 'Pistol', class: 'C', superchargedSlots: ['R1C1', 'R2C2'] },
    { id: 'g-2', kind: 'exosuit', name: 'Suit', superchargedSlots: ['R1C5'], slotLabels: { R1C5: 'Movement' } }
  ],
  notes: [
    {
      id: 'n-1',
      title: 'Scanner layout',
      body: 'Put the **Scanner** upgrades together.',
      pins: ['book3'],
      createdAt: hoursAgo(5),
      updatedAt: hoursAgo(5)
    }
  ],
  timers: [
    { id: 't-1', kind: 'refine', label: '250 Chromatic Metal', startedAt: hoursAgo(1), endsAt: hoursAgo(-0.5) },
    { id: 't-2', kind: 'crop', label: 'Frostwort', startedAt: hoursAgo(3), endsAt: hoursAgo(1) }
  ]
};

const GOLD = z.object({ items: z.array(z.object({ unitValue: z.number().nullable(), total: z.number().nullable() })) });

let wiki: Wiki;
beforeAll(async () => {
  wiki = await loadWiki();
});

async function connect(deps: Partial<Deps> = {}) {
  const server = createServer({
    loadWiki: () => Promise.resolve(wiki),
    loadLog: () => Promise.resolve(buildState(LOG)),
    now: () => NOW,
    ...deps
  });
  const client = new Client({ name: 'test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = (await client.callTool({ name, arguments: args })) as {
      content: { type: string; text: string }[];
      isError?: boolean;
    };
    const text = result.content[0]?.text ?? '';
    return { error: result.isError ? text : null, json: result.isError ? null : (JSON.parse(text) as unknown) };
  };
  return { client, call };
}

test('every tool is listed, read-only', async () => {
  const { client } = await connect();
  const { tools } = await client.listTools();
  expect(tools.map(tool => tool.name).sort()).toEqual([
    'best_crafts',
    'cited_facts',
    'get_system',
    'item_value',
    'list_gear',
    'list_systems',
    'list_timers',
    'outlaw_status',
    'plan_recipe',
    'read_article',
    'read_note',
    'search_codex',
    'search_notes'
  ]);
  expect(tools.every(tool => tool.annotations?.readOnlyHint === true)).toBe(true);
});

test('game answers come from the wiki mirror, with their Codex page and revision', async () => {
  const { call } = await connect();
  expect((await call('search_codex', { query: 'oxygen', limit: 1 })).json).toMatchObject({
    results: [
      {
        title: 'Oxygen',
        codex: 'https://atlas-os.cloud/app/wiki/#/a/wiki%2Fresources%2FOxygen.md',
        wiki: 'https://nomanssky.fandom.com/wiki/Oxygen',
        revision: expect.any(Number)
      }
    ]
  });

  expect((await call('read_article', { title: 'supercharged slot' })).json).toMatchObject({
    title: 'Supercharged Slot',
    body: expect.stringContaining('1 supercharged slot in Class C, 2 in Class B'),
    license: expect.stringContaining('CC BY-NC-SA 3.0')
  });
  const byLink = await call('read_article', {
    title: 'https://atlas-os.cloud/app/wiki/#/a/wiki%2Fmechanics%2FSupercharged_Slot.md'
  });
  expect(byLink.json).toMatchObject({ title: 'Supercharged Slot' });
  expect((await call('read_article', { title: 'No Such Page' })).error).toContain('No Codex article');

  expect((await call('plan_recipe', { item: 'Carbon Nanotubes', quantity: 2 })).json).toMatchObject({
    item: 'Carbon Nanotubes',
    gather: expect.arrayContaining([expect.objectContaining({ item: 'Carbon' })]),
    final: { make: 'Carbon Nanotubes', need: 2 }
  });

  const value = await call('item_value', { items: [{ name: 'Gold', quantity: 10 }, { name: 'Nothingite' }] });
  const gold = GOLD.parse(value.json);
  expect(gold.items[0]?.total).toBe((gold.items[0]?.unitValue ?? 0) * 10);
  expect(value.json).toMatchObject({ items: [{}, { unitValue: null, problem: 'not in the wiki mirror' }] });

  expect((await call('best_crafts', { limit: 2 })).json).toMatchObject({
    crafts: [
      { item: expect.stringMatching(/^(Stasis Device|Fusion Ignitor)$/), gain: expect.any(Number) },
      { item: expect.stringMatching(/^(Stasis Device|Fusion Ignitor)$/) }
    ]
  });
  expect((await call('best_crafts', { maxSteps: 3, limit: 50 })).json).toMatchObject({
    crafts: expect.not.arrayContaining([expect.objectContaining({ item: 'Stasis Device' })])
  });

  expect((await call('cited_facts')).json).toMatchObject({
    facts: expect.arrayContaining([
      expect.objectContaining({ id: 'supercharged-per-class', value: { C: 1, B: 2, A: 3, S: 4 } })
    ])
  });
});

test('player answers come from the log, computed as the app computes them', async () => {
  const { call } = await connect();
  expect((await call('outlaw_status')).json).toMatchObject({
    ready: [{ name: 'Vela Drift', ready: true }],
    restocking: [{ name: 'Harrow Gate', readyAt: hoursAgo(-22) }],
    nextRun: { stations: ['Vela Drift'], packets: 15 }
  });

  expect((await call('list_systems', { tag: 'outlaw' })).json).toMatchObject({ total: 2 });
  expect((await call('list_systems', { query: 'economy' })).json).toMatchObject({ systems: [{ name: 'Quiet Reach' }] });
  expect((await call('get_system', { name: 'vela drift' })).json).toMatchObject({
    glyphs: '21A4F03A0E10',
    glyphNames: [
      'Face',
      'Bird',
      'Voxel',
      'Eclipse',
      'Atlas',
      'Sunset',
      'Diplo',
      'Voxel',
      'Sunset',
      'Tree',
      'Bird',
      'Sunset'
    ],
    planets: [{ name: 'Kesh', notes: 'Storm crystals' }]
  });

  expect((await call('list_gear')).json).toMatchObject({
    gear: [
      {
        name: 'Pistol',
        wikiRules: { superchargedSlots: 1, techGrid: { columns: 10, maxRows: 3 } },
        disagreesWithWiki: { moreSuperchargedThanClassHas: true }
      },
      {
        kind: 'exosuit',
        superchargedSlots: [{ slot: 'R1C5', holds: 'Movement' }],
        wikiRules: { fixedSlots: ['R1C5', 'R2C9', 'R3C3'] }
      }
    ]
  });

  expect((await call('search_notes', { query: 'scanner' })).json).toMatchObject({
    notes: [{ title: 'Scanner layout', pinnedTo: ['Book III'] }]
  });
  expect((await call('read_note', { title: 'scanner layout' })).json).toMatchObject({
    body: expect.stringContaining('**Scanner**')
  });

  expect((await call('list_timers')).json).toEqual({
    now: new Date(NOW).toISOString(),
    running: [{ label: '250 Chromatic Metal', kind: 'refine', endsAt: hoursAgo(-0.5), minutesLeft: 30 }],
    done: [{ label: 'Frostwort', kind: 'crop', endedAt: hoursAgo(1) }]
  });
});

test('game data that fails to load is reported, and the next call tries again', async () => {
  let attempts = 0;
  const { call } = await connect({
    loadWiki: () =>
      ++attempts === 1 ? Promise.reject(new Error('The game data couldn’t be downloaded')) : Promise.resolve(wiki)
  });
  expect((await call('search_codex', { query: 'gold' })).error).toContain('couldn’t be downloaded');
  expect((await call('list_gear')).json).toMatchObject({ gear: [{ name: 'Pistol' }, { name: 'Suit' }] }); // rules or not, the log answers
  expect((await call('search_codex', { query: 'gold', limit: 1 })).error).toBeNull();
});

test('without a log, or with a broken setting, player tools say why and game tools still work', async () => {
  const none = await connect({ loadLog: null });
  expect((await none.call('outlaw_status')).error).toContain('ATLAS_SYNC_CODE');
  expect((await none.call('search_codex', { query: 'gold' })).error).toBeNull();
  const broken = await connect({ loadLog: null, logSetupError: 'ATLAS_SYNC_CODE isn’t a sync code' });
  expect((await broken.call('list_gear')).error).toBe('ATLAS_SYNC_CODE isn’t a sync code');
  expect(() => logSourceFromEnv({ ATLAS_SYNC_CODE: 'not-a-code' })).toThrow(LogError);
  expect(() => logSourceFromEnv({ ATLAS_SYNC_CODE: newSyncCode(), ATLAS_SYNC_URL: 'http://evil.example' })).toThrow(
    LogError
  );
  expect(logSourceFromEnv({})).toBeNull();
});

// A relay that holds one sealed copy and records every request.
async function fakeRelay(
  code: string,
  { version = 7, etag, status = 200 }: { version?: number; etag?: number; status?: number } = {}
) {
  const keys = await deriveSyncKeys(code);
  const blob = await sealState(keys, JSON.stringify(LOG), version);
  const requests: { method: string; url: string; auth: string | null }[] = [];
  const fetcher: typeof fetch = (input, init) => {
    requests.push({
      method: init?.method ?? 'GET',
      url: input instanceof Request ? input.url : String(input),
      auth: new Headers(init?.headers).get('Authorization')
    });
    return Promise.resolve(
      status === 200
        ? new Response(blob, { headers: { ETag: `"${String(etag ?? version)}"` } })
        : new Response(null, { status })
    );
  };
  return { keys, requests, fetcher };
}

test('with a sync code, the copy is fetched with GET only, opened locally, checked, and cached for a minute', async () => {
  const code = newSyncCode();
  const relay = await fakeRelay(code);
  let now = NOW;
  const source = logSourceFromEnv({ ATLAS_SYNC_CODE: `https://relmaur.github.io/nms-os/#pair=${code}` });
  expect(source).toEqual({ kind: 'sync', code, url: 'https://atlas-os.cloud/api/sync' });
  if (!source) throw new Error('no source');
  const load = makeLogLoader(source, { fetcher: relay.fetcher, now: () => now });
  const state: AppState = await load();
  expect(state.systems.map(system => system.name)).toEqual(['Vela Drift', 'Harrow Gate', 'Quiet Reach']);
  await load();
  now += CACHE_MS;
  await load();
  expect(relay.requests).toEqual([
    {
      method: 'GET',
      url: `https://atlas-os.cloud/api/sync/v1/vaults/${relay.keys.vaultId}`,
      auth: `Bearer ${relay.keys.token}`
    },
    expect.objectContaining({ method: 'GET' })
  ]);
});

test('a wrong code, a relabelled copy and relay refusals are reported, never guessed around', async () => {
  const right = newSyncCode();
  const relay = await fakeRelay(right);
  const wrong = makeLogLoader({ kind: 'sync', code: newSyncCode(), url: 'https://relay.test' }, relay);
  await expect(wrong()).rejects.toThrow('doesn’t open with this code');
  const relabelled = await fakeRelay(right, { version: 7, etag: 9 });
  await expect(makeLogLoader({ kind: 'sync', code: right, url: 'https://relay.test' }, relabelled)()).rejects.toThrow(
    'doesn’t open'
  );
  for (const [status, message] of [
    [404, 'No synced copy'],
    [401, 'no longer valid'],
    [503, 'unavailable']
  ] as const) {
    const refused = await fakeRelay(right, { status });
    await expect(makeLogLoader({ kind: 'sync', code: right, url: 'https://relay.test' }, refused)()).rejects.toThrow(
      message
    );
  }
});

test('with an exported file, the log is read from disk and checked like an import', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-mcp-'));
  const good = path.join(dir, 'nms_state.json');
  await fs.writeFile(good, JSON.stringify(LOG));
  expect((await makeLogLoader({ kind: 'file', path: good })()).notes[0]?.title).toBe('Scanner layout');
  const bad = path.join(dir, 'bad.json');
  await fs.writeFile(bad, JSON.stringify({ systems: 'not a list' }));
  await expect(makeLogLoader({ kind: 'file', path: bad })()).rejects.toThrow('isn’t a valid ATLAS log');
  await expect(makeLogLoader({ kind: 'file', path: path.join(dir, 'missing.json') })()).rejects.toThrow(
    'can’t be read'
  );
  await fs.rm(dir, { recursive: true });
});

test('review fixes: old exports migrate, calls share one read, unlabelled copies are refused, inputs are forgiving', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-mcp-'));
  const legacy = path.join(dir, 'old.json');
  await fs.writeFile(
    legacy,
    JSON.stringify({ checkedItems: {}, logEntries: [{ id: '1', title: 'Euclid Prime', category: 'discovery' }] })
  );
  expect((await makeLogLoader({ kind: 'file', path: legacy })()).systems.map(s => s.name)).toEqual(['Euclid Prime']);
  await fs.rm(dir, { recursive: true });

  const code = newSyncCode();
  const relay = await fakeRelay(code);
  const load = makeLogLoader({ kind: 'sync', code, url: 'https://relay.test' }, relay);
  await Promise.all([load(), load(), load()]);
  expect(relay.requests).toHaveLength(1);

  const unlabelled = await fakeRelay(code);
  const bare: typeof fetch = async (input, init) => {
    const response = await unlabelled.fetcher(input, init);
    return new Response(await response.arrayBuffer());
  };
  await expect(makeLogLoader({ kind: 'sync', code, url: 'https://relay.test' }, { fetcher: bare })()).rejects.toThrow(
    'no version'
  );

  const { call } = await connect();
  expect((await call('read_article', { title: '100%' })).error).toContain('No Codex article');
  expect((await call('list_systems', { tag: 'Outlaw' })).json).toMatchObject({ total: 2 });
  expect((await call('list_systems', { query: '   ' })).json).toMatchObject({ total: 3 });
  expect((await call('list_systems', { query: 'e' })).json).toMatchObject({
    systems: [{ name: 'Quiet Reach' }, { name: 'Harrow Gate' }, { name: 'Vela Drift' }]
  });
});
