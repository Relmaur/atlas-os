// Schema guard for the state document (docs/state-schema.md): imports, the browser copy and the repo's
// nms_state.json all pass through validateState() before they can replace anything.
// Keys may be missing or null (older exports predate newer keys; buildState() fills defaults), but every key that is
// present must have the right type. Unknown keys are allowed so newer exports still load in older builds.
// Messages are written for people ("systems[2].name must be text"); key order below is the order errors are listed.
import { z } from 'zod';
import { SAFE_ID } from './util.ts';

const MAX_ERRORS = 5;

const object = <T extends z.core.$ZodLooseShape>(shape: T) => z.looseObject(shape, { error: 'must be an object' });
const list = <T extends z.ZodType>(item: T) => z.array(item, { error: 'must be a list' });
const text = z.string({ error: 'must be text' });
const date = z.custom<string>(value => typeof value === 'string' && !Number.isNaN(Date.parse(value)), {
  error: 'must be a date'
});
// Numeric strings count: older exports wrote settings from form fields.
const positive = z.custom<number | string>(value => Number(value) > 0, { error: 'must be a positive number' });
// Ids are interpolated into inline handlers, so only safe characters are accepted (see SAFE_ID in util.ts).
const id = z.custom<string | number>(
  value => (typeof value === 'string' || Number.isInteger(value)) && SAFE_ID.test(String(value)),
  { error: 'must use only letters, digits, - and _' }
);
const withId = object({ id: id.nullish() });

export const StateDocumentSchema = object({
  meta: object({ lastUpdated: date.nullish(), currentPhase: text.nullish() }).nullish(),
  fleet: object({}).nullish(),
  checklists: z
    .record(z.string(), z.boolean({ error: 'must be true or false' }), { error: 'must be an object' })
    .nullish(),
  outlaw: object({
    restockHours: positive.nullish(),
    packetsPerVisit: positive.nullish(),
    runSize: positive.nullish(),
    unitsPerPacket: positive.nullish(),
    nanitesPerPacket: positive.nullish(),
    runStartedAt: date.nullish(),
    stations: list(withId).nullish() // legacy, migrated by buildState()
  }).nullish(),
  systems: list(
    object({
      name: text,
      id: id.nullish(),
      tags: list(text).nullish(),
      notes: text.nullish(),
      planets: list(withId).nullish(),
      visits: list(object({ at: date })).nullish()
    })
  ).nullish(),
  logbook: list(withId).nullish(), // legacy, migrated by buildState()
  // Entries are checked by buildState(), which drops a damaged one: a bad timer must not set the whole log aside.
  timers: list(object({})).nullish(),
  session: object({}).nullish(),
  sessions: list(object({})).nullish(),
  gear: list(object({})).nullish(),
  notes: list(object({})).nullish(),
  devices: list(object({})).nullish(),
  runs: list(object({})).nullish(),
  accounts: list(z.unknown()).nullish(), // names; buildState() drops anything that isn't one
  myGlyphs: list(z.unknown()).nullish() // digits; the same
});

export type StateDocument = z.infer<typeof StateDocumentSchema>;
export interface SchemaError {
  path: string;
  message: string;
}

// ["systems", 2, "name"] → "systems[2].name"
function formatPath(path: readonly PropertyKey[]): string {
  return path.map((key, i) => (typeof key === 'number' ? `[${key}]` : `${i ? '.' : ''}${String(key)}`)).join('');
}

export function validateState(state: unknown): { ok: boolean; errors: SchemaError[] } {
  if (state === null || typeof state !== 'object' || Array.isArray(state)) {
    return { ok: false, errors: [{ path: '(root)', message: 'must be a JSON object' }] };
  }
  const result = StateDocumentSchema.safeParse(state);
  if (result.success) return { ok: true, errors: [] };
  const errors = result.error.issues
    .slice(0, MAX_ERRORS)
    .map(issue => ({ path: formatPath(issue.path), message: issue.message }));
  return { ok: false, errors };
}

// One line a person can act on: "systems[2].name must be text".
export function describeErrors(errors: SchemaError[]): string {
  return errors.map(error => `${error.path} ${error.message}`).join('; ');
}
