// Recipe planner (design 13), its own screen at #plan/<item>: what the item is worth, then one path in play order:
// Gather (a cargo checklist), each crafting round, the final craft. Every item opens a Codex peek (34). Every number
// is the wiki's recipes and base values, or arithmetic on them (docs/calculators.md). Opened from Best crafts, a
// Codex item or Calculators; "Change item" plans another (owner, 2026-10-30: the design has no picker).
import { LoadFailed, RowsLoading } from '../parts/Loading.tsx';
import { useCallback, useMemo, useState } from 'react';
import { formatQty } from '@atlas/core/calc';
import {
  buildPlan,
  carryTicks,
  findItem,
  planProgress,
  planRecipes,
  rawKey,
  stepKey,
  untick,
  type BuildPlan,
  type Catalog,
  type PlanStep
} from '@atlas/core/planner';
import { planPath, toggleRound, type PathStep } from '@atlas/core/plan-path';
import { showToast } from '../../app/ui.ts';
import { goBack, useSection, useSectionParam } from '../shell/section-store.ts';
import { Button } from '../parts/Button.tsx';
import { FIELD } from '../systems/editor-parts.tsx';
import { loadGameData, useGameData } from './game-data.ts';
import { readProgress, writeProgress, type PlanSettings } from './progress.ts';
import { CodexPeek } from './CodexPeek.tsx';
import { PlanDesk } from './PlanDesk.tsx';
import { useMedia } from '../parts/useMedia.ts';
import { openPlan, rawValue, ratioText, recipeSwitch, type RecipeSwitch } from './plan-bits.ts';

const MAX_QTY = 9999;
const TOP_BUTTON =
  'w-11 h-11 rounded-control bg-slate-ground border border-control-edge grid place-items-center text-ink hover:border-control-edge-hover';
const ITEM_NAME =
  'text-left text-ink underline decoration-dotted decoration-scanner-cyan-pale/60 underline-offset-4 hover:text-ink-bright';
const NODE: Record<PathStep['state'], string> = {
  done: 'border border-ready-emerald-edge bg-ready-emerald-tint text-ready-emerald-text',
  now: 'border-[1.5px] border-scanner-cyan-glow bg-[rgba(34,211,238,0.14)] text-[#cffafe]',
  next: 'border border-control-edge bg-slate-ground text-ink-soft'
};

export function PlanScreen() {
  const section = useSection();
  const title = useSectionParam();
  const data = useGameData();
  if (section !== 'plan') return null;
  if (data.status !== 'ready')
    return (
      <div className="pt-[env(safe-area-inset-top)]">
        {data.status === 'failed' ? (
          <LoadFailed what="The recipe data" onRetry={() => void loadGameData()} />
        ) : (
          <RowsLoading label="Loading recipes" />
        )}
      </div>
    );
  const item = findItem(data.catalog, title);
  if (!item || !planRecipes(data.catalog, item).length)
    return (
      <div className="flex flex-col items-start gap-section pt-[env(safe-area-inset-top)]">
        <h1 className="font-display text-screen-title text-ink-bright">Nothing to plan</h1>
        <p className="text-sub text-ink-muted">
          {item ? `${item.title} has no crafting or cooking recipe on the wiki.` : `“${title}” isn’t in the wiki data.`}
        </p>
        <Button
          onClick={() => {
            goBack('calculators');
          }}
        >
          Back
        </Button>
      </div>
    );
  return <Planner key={item.title} catalog={data.catalog} item={item.title} />;
}

function Planner({ catalog, item }: { catalog: Catalog; item: string }) {
  // The saved plan comes back with its ticks when it's this item's; another item starts fresh (and replaces it).
  const [saved] = useState(() => {
    const progress = readProgress();
    if (progress?.item === item) return progress;
    writeProgress({ item, qty: 1, choices: {} }, new Set()); // opening an item makes it the plan Calculators shows
    return null;
  });
  const [settings, setSettings] = useState<PlanSettings>(() => saved ?? { item, qty: 1, choices: {} });
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set(saved?.ticked ?? []));
  const [peek, setPeek] = useState<{ title: string; session: number } | null>(null);
  const [changing, setChanging] = useState(false);
  const closePeek = useCallback(() => {
    setPeek(null);
  }, []);
  const plan = useMemo(() => buildPlan(catalog, settings.item, settings.qty, settings.choices), [catalog, settings]);
  const wide = useMedia('(min-width: 1024px)');

  const save = (next: PlanSettings, nextTicked: ReadonlySet<string>) => {
    setSettings(next);
    setTicked(nextTicked);
    writeProgress(next, nextTicked);
  };
  // Another amount or recipe keeps the ticks wherever what was gathered or crafted still covers the new need.
  const replan = (next: PlanSettings) => {
    const nextPlan = buildPlan(catalog, next.item, next.qty, next.choices);
    save(next, nextPlan ? carryTicks(nextPlan, ticked) : ticked);
  };
  const setQty = (value: number) => {
    const qty = Math.max(1, Math.min(MAX_QTY, Math.round(value) || 1));
    if (qty !== settings.qty) replan({ ...settings, qty });
  };
  const toggle = (key: string) => {
    save(settings, ticked.has(key) ? untick(ticked, key) : new Set(ticked).add(key));
  };
  if (!plan) return null;
  const progress = planProgress(plan, ticked);
  const path = planPath(plan, progress);
  const open = (title: string) => {
    setPeek(current => ({ title, session: (current?.session ?? 0) + 1 }));
  };
  const lit = peek?.title;
  const step =
    plan.rounds.flat().find(item => item.title === lit) ?? (plan.product.title === lit ? plan.product : null);
  const switcher: RecipeSwitch | null = step
    ? recipeSwitch(catalog, settings, plan, step, choices => {
        replan({ ...settings, choices });
      })
    : null;

  if (wide) {
    // The docked peek shows the item last picked; before any, the product.
    const shown = lit ?? plan.product.title;
    const shownStep =
      plan.rounds.flat().find(item => item.title === shown) ?? (plan.product.title === shown ? plan.product : null);
    return (
      <PlanDesk
        catalog={catalog}
        plan={plan}
        qty={settings.qty}
        maxQty={MAX_QTY}
        path={path}
        ticked={ticked}
        peek={shown}
        switcher={
          shownStep
            ? recipeSwitch(catalog, settings, plan, shownStep, choices => {
                replan({ ...settings, choices });
              })
            : null
        }
        changeItem={<ChangeItem catalog={catalog} current={item} />}
        choices={Object.keys(settings.choices).length > 0}
        onQty={setQty}
        onOpen={open}
        onToggle={toggle}
        onRound={round => {
          save(settings, toggleRound(plan, ticked, round));
        }}
        onFinal={() => {
          toggle(stepKey(plan.product));
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-section max-w-2xl pt-[env(safe-area-inset-top)]">
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              goBack('calculators');
            }}
            aria-label="Back"
            className={TOP_BUTTON}
          >
            <i className="ph-bold ph-caret-left text-lg" aria-hidden="true" />
          </button>
          <span className="inline-flex items-center h-7 px-3 rounded-full border border-control-edge bg-slate-ground text-[12px] font-semibold text-ink-soft">
            {path.steps.length} steps
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 mt-4">
          <p className="text-label uppercase text-ink-label">Recipe planner</p>
          <button
            type="button"
            aria-expanded={changing}
            aria-controls="planChange"
            onClick={() => {
              setChanging(!changing);
            }}
            className="text-caption font-semibold text-scanner-cyan-pale hover:text-quantity-cyan"
          >
            Change item
          </button>
        </div>
        <h1 id="planTitle" className="font-display text-screen-title text-ink-bright break-words">
          {plan.product.title}
        </h1>
        {changing && <ChangeItem catalog={catalog} current={item} />}
      </header>

      <Worth plan={plan} qty={settings.qty} onQty={setQty} />

      <section
        aria-labelledby="planPathTitle"
        className="rounded-card bg-panel-glass border border-hairline p-4 flex flex-col gap-3"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="planPathTitle" className="font-display font-bold text-[15px] text-ink-bright">
            Your path
          </h2>
          <span className="font-mono text-[12px] text-ink-muted">
            {progress.complete ? 'all done' : `step ${String(path.current + 1)} of ${String(path.steps.length)}`}
          </span>
        </div>
        <div
          aria-hidden="true"
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${String(path.steps.length)}, 1fr)` }}
        >
          {path.steps.map((item, i) => (
            <i
              key={i}
              className={`h-1 rounded-full ${i <= path.current || item.state === 'done' ? 'bg-scanner-cyan-glow' : 'bg-hairline'}`}
            />
          ))}
        </div>
        <ol id="planPath" className="flex flex-col mt-1">
          {path.steps.map((item, i) => (
            <li
              key={i}
              className="flex gap-3"
              data-step={item.kind}
              aria-current={item.state === 'now' ? 'step' : undefined}
            >
              <div className="flex flex-col items-center shrink-0">
                <span
                  className={`w-[30px] h-[30px] rounded-full grid place-items-center font-mono text-[12px] ${NODE[item.state]}`}
                >
                  {item.state === 'done' ? <i className="ph-bold ph-check" aria-label="Done" /> : i + 1}
                </span>
                {i < path.steps.length - 1 && <span className="flex-1 w-px bg-hairline my-1" />}
              </div>
              <div className="flex-1 min-w-0 pt-1 pb-[18px] flex flex-col gap-2">
                {item.kind === 'gather' ? (
                  <Gather
                    plan={plan}
                    ticked={ticked}
                    now={item.state === 'now'}
                    lit={lit}
                    onToggle={toggle}
                    onOpen={open}
                  />
                ) : item.kind === 'round' ? (
                  <Round
                    plan={plan}
                    index={item.round}
                    done={item.state === 'done'}
                    lit={lit}
                    onOpen={open}
                    onToggle={() => {
                      save(settings, toggleRound(plan, ticked, item.round));
                    }}
                  />
                ) : (
                  <Final
                    plan={plan}
                    done={item.state === 'done'}
                    lit={lit}
                    onOpen={open}
                    onToggle={() => {
                      toggle(stepKey(plan.product));
                    }}
                  />
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <p className="font-mono text-[11px] text-ink-label">
        Recipes from the NMS wiki · {plan.product.title} · revision {plan.product.item?.revId} ·{' '}
        {Object.keys(settings.choices).length ? 'your recipe choices' : 'first recipe of each item'}
      </p>

      {peek && (
        <CodexPeek
          key={peek.session}
          catalog={catalog}
          plan={plan}
          title={peek.title}
          switcher={switcher}
          onClose={closePeek}
        />
      )}
    </div>
  );
}

function ChangeItem({ catalog, current }: { catalog: Catalog; current: string }) {
  const [query, setQuery] = useState('');
  const craftable = useMemo(
    () =>
      [...catalog.byTitle.values()]
        .filter(item => !item.obsolete && planRecipes(catalog, item).length)
        .map(item => item.title)
        .sort((a, b) => a.localeCompare(b)),
    [catalog]
  );
  const pick = (value: string) => {
    const item = findItem(catalog, value);
    if (!item) return;
    if (!planRecipes(catalog, item).length) {
      showToast(`${item.title} has no crafting or cooking recipe on the wiki.`);
      return;
    }
    if (item.title !== current) openPlan(item.title);
  };
  return (
    <div id="planChange" className="mt-2">
      <input
        id="planItem"
        list="planItemOptions"
        type="search"
        autoComplete="off"
        spellCheck={false}
        autoFocus
        aria-label="Item to plan"
        value={query}
        placeholder="Search craftable and cookable items"
        onChange={event => {
          setQuery(event.target.value);
          // A pick from the list is the item's exact name: plan it at once. Typing waits for Enter.
          if (craftable.includes(event.target.value)) pick(event.target.value);
        }}
        onKeyDown={event => {
          if (event.key === 'Enter') pick(query);
        }}
        className={FIELD}
      />
      <datalist id="planItemOptions">
        {craftable.map(title => (
          <option key={title} value={title} />
        ))}
      </datalist>
    </div>
  );
}

function Worth({ plan, qty, onQty }: { plan: BuildPlan; qty: number; onQty: (qty: number) => void }) {
  const worth = (plan.product.item?.value ?? 0) * plan.product.qty;
  const inputs = rawValue(plan);
  const ratio = ratioText(worth, inputs);
  const [text, setText] = useState(String(qty));
  const [prev, setPrev] = useState(qty);
  if (prev !== qty) {
    setPrev(qty); // changed by − or +: show it
    setText(String(qty));
  }
  const step =
    'w-11 h-[34px] rounded-segment grid place-items-center text-ink-soft hover:text-ink-bright disabled:opacity-40';
  return (
    <section
      aria-label="What it's worth"
      className="rounded-card bg-panel-glass border border-[rgba(251,191,36,0.35)] p-4 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label uppercase text-ink-label">Product worth</p>
          <p id="planWorth" className="font-mono text-[22px] font-semibold text-units-amber-text mt-1">
            {worth ? worth.toLocaleString() : 'not on the wiki'}
          </p>
        </div>
        {ratio && (
          <span className="inline-flex items-center h-[30px] px-3 rounded-full border border-[rgba(252,211,77,0.45)] bg-[rgba(252,211,77,0.1)] font-mono text-[14px] text-units-amber-text">
            <span className="sr-only">Worth </span>×{ratio}
            <span className="sr-only"> its raw inputs</span>
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sub text-ink-muted">Raw inputs worth</span>
        <span className="font-mono text-[14px] text-[#fde68a]">{inputs.toLocaleString()}</span>
      </div>
      {worth > 0 && (
        <div aria-hidden="true" className="h-1.5 rounded-full bg-hairline overflow-hidden">
          <span
            className="block h-full min-w-1 bg-[#fbbf24]"
            style={{ width: `${String(Math.min(100, (inputs / worth) * 100))}%` }}
          />
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="planQty" className="text-sub text-ink-muted">
          Quantity
        </label>
        <div className="flex gap-1 p-1 rounded-control bg-slate-ground border border-hairline">
          <button
            type="button"
            aria-label="One fewer"
            disabled={qty <= 1}
            onClick={() => {
              onQty(qty - 1);
            }}
            className={step}
          >
            <i className="ph-bold ph-minus" aria-hidden="true" />
          </button>
          <input
            id="planQty"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_QTY}
            value={text}
            onChange={event => {
              setText(event.target.value);
            }}
            // A typed amount applies on Enter or leaving the field, so a stray keystroke doesn't replan.
            onKeyDown={event => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            onBlur={() => {
              const value = Number(text);
              if (text !== '' && value >= 1) onQty(value);
              setText(String(Math.max(1, Math.min(MAX_QTY, Math.round(value) || qty))));
            }}
            className="w-14 h-[34px] rounded-segment bg-[rgba(16,185,129,0.18)] text-[#d1fae5] shadow-[inset_0_0_0_1px_rgba(52,211,153,0.45)] text-center font-mono text-[13px] font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            aria-label="One more"
            disabled={qty >= MAX_QTY}
            onClick={() => {
              onQty(qty + 1);
            }}
            className={step}
          >
            <i className="ph-bold ph-plus" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}

const litName = (on: boolean) =>
  on
    ? 'text-[#cffafe] bg-[rgba(34,211,238,0.16)] rounded-md px-1.5 -mx-1.5 py-0.5 -my-0.5 no-underline shadow-[inset_0_0_0_1px_rgba(34,211,238,0.5)]'
    : '';

function StepHead({ title, meta, now }: { title: string; meta: string; now?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="font-display font-bold text-[14px] text-ink-bright">{title}</h3>
      <span className={`font-mono text-[11px] ${now ? 'text-scanner-cyan-pale' : 'text-ink-muted'}`}>{meta}</span>
    </div>
  );
}

function Gather({
  plan,
  ticked,
  now,
  lit,
  onToggle,
  onOpen
}: {
  plan: BuildPlan;
  ticked: ReadonlySet<string>;
  now: boolean;
  lit: string | undefined;
  onToggle: (key: string) => void;
  onOpen: (title: string) => void;
}) {
  const gathered = plan.raw.filter(entry => ticked.has(rawKey(entry.title, entry.qty))).length;
  return (
    <>
      <StepHead title="Gather" meta={`${String(gathered)} / ${String(plan.raw.length)}`} now={now} />
      <p className="text-caption text-ink-muted">
        Fill your cargo with these first. Tick them as they land; tap a name for its Codex entry.
      </p>
      <ul id="planCargo">
        {plan.raw.map(entry => {
          const key = rawKey(entry.title, entry.qty);
          return (
            <li
              key={entry.title}
              data-raw={entry.title}
              data-qty={entry.qty}
              className="flex items-center justify-between gap-2 py-2 border-t border-hairline first:border-t-0"
            >
              <span className="flex items-center gap-2.5 min-w-0 min-h-7">
                <input
                  type="checkbox"
                  checked={ticked.has(key)}
                  onChange={() => {
                    onToggle(key);
                  }}
                  aria-label={`Gathered ${formatQty(entry.qty)} ${entry.title}`}
                  className="w-5 h-5 shrink-0 accent-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    onOpen(entry.title);
                  }}
                  aria-label={`${entry.title}: open in Codex`}
                  className={`text-[14px] truncate ${ITEM_NAME} ${litName(lit === entry.title)}`}
                >
                  {entry.title}
                </button>
              </span>
              <span className="font-mono text-[13px] text-quantity-cyan shrink-0">{formatQty(entry.qty)}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function ItemPill({ step, lit, onOpen }: { step: PlanStep; lit: boolean; onOpen: (title: string) => void }) {
  const name = step.qty > 1 ? `${step.title} ×${formatQty(step.qty)}` : step.title;
  return (
    <button
      type="button"
      onClick={() => {
        onOpen(step.title);
      }}
      aria-label={`${name}: open in Codex`}
      className={`inline-flex items-center h-7 px-2.5 rounded-full border text-[12px] font-semibold text-[#cffafe] ${
        lit
          ? 'border-scanner-cyan-glow bg-[rgba(34,211,238,0.18)] shadow-[0_0_0_3px_rgba(34,211,238,0.15)]'
          : 'border-[rgba(34,211,238,0.28)] bg-[rgba(34,211,238,0.06)]'
      }`}
    >
      {name}
    </button>
  );
}

function DoneToggle({ done, label, onToggle }: { done: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={done}
      onClick={onToggle}
      className={`self-start inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12px] font-semibold ${
        done
          ? 'border-ready-emerald-edge bg-ready-emerald-tint text-ready-emerald-text'
          : 'border-control-edge bg-slate-ground text-ink-soft hover:text-ink-bright'
      }`}
    >
      <i className={`ph-bold ${done ? 'ph-check' : 'ph-hammer'}`} aria-hidden="true" />
      {label}
    </button>
  );
}

function Round({
  plan,
  index,
  done,
  lit,
  onOpen,
  onToggle
}: {
  plan: BuildPlan;
  index: number;
  done: boolean;
  lit: string | undefined;
  onOpen: (title: string) => void;
  onToggle: () => void;
}) {
  const round = plan.rounds[index] ?? [];
  const verb = round.every(step => step.recipe.type === 'cook') ? 'Cook' : 'Craft';
  return (
    <>
      <StepHead
        title={`${verb} · Round ${String(index + 1)}`}
        meta={`${String(round.length)} item${round.length === 1 ? '' : 's'}`}
      />
      <p className="text-caption text-ink-muted">
        {index === 0 ? 'From what you gathered' : `Uses what you made in round ${String(index)}`}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {round.map(step => (
          <ItemPill key={step.title} step={step} lit={lit === step.title} onOpen={onOpen} />
        ))}
      </div>
      <DoneToggle
        done={done}
        label={done ? `Round ${String(index + 1)} crafted` : 'Mark crafted'}
        onToggle={onToggle}
      />
    </>
  );
}

function Final({
  plan,
  done,
  lit,
  onOpen,
  onToggle
}: {
  plan: BuildPlan;
  done: boolean;
  lit: string | undefined;
  onOpen: (title: string) => void;
  onToggle: () => void;
}) {
  const { product } = plan;
  const name = (title: string, className = '') => (
    <button
      type="button"
      onClick={() => {
        onOpen(title);
      }}
      aria-label={`${title}: open in Codex`}
      className={`${ITEM_NAME} ${className} ${litName(lit === title)}`}
    >
      {title}
    </button>
  );
  return (
    <>
      <StepHead
        title={product.recipe.type === 'cook' ? 'Final cook' : 'Final craft'}
        meta={`×${formatQty(product.qty)}`}
      />
      <div className="flex flex-col gap-1.5 p-3 rounded-[14px] border border-[rgba(251,191,36,0.35)] bg-[rgba(245,158,11,0.06)]">
        <span className="text-[13px] text-ink-soft">
          {product.inputs.map((input, i) => (
            <span key={input.title}>
              {i > 0 && ' + '}
              {input.qty > 1 && <span className="font-mono">{formatQty(input.qty)} </span>}
              {name(input.title)}
            </span>
          ))}
        </span>
        <b className="font-display font-bold text-[16px] text-[#fde68a]">= {name(product.title, 'text-inherit')}</b>
        {product.item?.value ? (
          <small className="font-mono text-[11px] text-ink-muted">
            worth {product.item.value.toLocaleString()} each
          </small>
        ) : null}
      </div>
      <DoneToggle done={done} label={done ? 'Crafted. The plan is done' : 'Mark crafted'} onToggle={onToggle} />
    </>
  );
}
