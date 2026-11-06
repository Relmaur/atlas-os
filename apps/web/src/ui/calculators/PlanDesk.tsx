// The Recipe planner on the Workbench (round 6, d11): the whole path at once, a column per step (Gather, each round,
// the final craft) under a bar that says where you are, and the Codex peek docked beside it for the item last picked.
// The numbers are the phone's (design 13): the wiki's recipes and base values, and arithmetic on them.
import { useState, type ReactNode } from 'react';
import { formatQty } from '@atlas/core/calc';
import { rawKey, type BuildPlan, type Catalog } from '@atlas/core/planner';
import type { PathStep, planPath } from '@atlas/core/plan-path';
import { useWidth } from '../parts/useWidth.ts';
import { CodexPeekDock } from './CodexPeek.tsx';
import { rawValue, ratioText, type RecipeSwitch } from './plan-bits.ts';

const BAR: Record<PathStep['state'], string> = {
  done: 'bg-ready-emerald-bright',
  now: 'bg-scanner-cyan-glow',
  next: 'bg-hairline'
};
const GATHER_MIN = 176;
const STEP_MIN = 128;
const COLUMN = 'min-w-0 rounded-control bg-[rgba(15,23,42,0.55)] p-3 flex flex-col gap-2';
const ITEM =
  'w-full min-h-9 px-2 py-1.5 rounded-[calc(var(--radius-control)-4px)] text-left text-[13px] leading-snug break-words hyphens-auto text-ink bg-[rgba(30,41,59,0.6)] hover:bg-[rgba(51,65,85,0.6)]';
const LIT = 'shadow-[inset_0_0_0_1.5px_var(--color-scanner-cyan-glow)] text-ink-bright';

export function PlanDesk({
  catalog,
  plan,
  qty,
  maxQty,
  path,
  ticked,
  peek,
  switcher,
  changeItem,
  choices,
  onQty,
  onOpen,
  onToggle,
  onRound,
  onFinal
}: {
  catalog: Catalog;
  plan: BuildPlan;
  qty: number;
  maxQty: number;
  path: ReturnType<typeof planPath>;
  ticked: ReadonlySet<string>;
  /** The item in the docked peek: the one last picked, else the product. */
  peek: string;
  switcher: RecipeSwitch | null;
  changeItem: ReactNode;
  /** Whether any item uses a recipe other than its first. */
  choices: boolean;
  onQty: (qty: number) => void;
  onOpen: (title: string) => void;
  onToggle: (key: string) => void;
  onRound: (round: number) => void;
  onFinal: () => void;
}) {
  const [changing, setChanging] = useState(false);
  const worth = (plan.product.item?.value ?? 0) * plan.product.qty;
  const ratio = ratioText(worth, rawValue(plan));
  const { product } = plan;
  // One row when every step has room (Gather wider, for its names and amounts), else the steps wrap onto rows.
  const [board, width] = useWidth<HTMLOListElement>();
  const others = path.steps.length - 1;
  const oneRow = width - 44 - 12 * others >= GATHER_MIN + STEP_MIN * others;
  const columns = oneRow
    ? `minmax(${String(GATHER_MIN)}px, 1.15fr) repeat(${String(others)}, minmax(0, 1fr))`
    : `repeat(auto-fill, minmax(${String(GATHER_MIN)}px, 1fr))`;
  const gathered = plan.raw.filter(entry => ticked.has(rawKey(entry.title, entry.qty))).length;

  return (
    <div className="plan-desk grid h-full grid-cols-[minmax(0,1fr)_minmax(0,clamp(300px,24%,380px))] gap-[var(--spacing-pane-gap)]">
      <section aria-labelledby="planTitle" className="workbench-panel min-w-0 min-h-0 flex flex-col">
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-[22px] pt-5 pb-4">
          <div className="min-w-0 flex flex-col gap-1">
            <p className="text-label uppercase text-ink-label">
              Recipe planner · {path.steps.length} step{path.steps.length === 1 ? '' : 's'}
            </p>
            <h1
              id="planTitle"
              title={product.title}
              className="font-display font-extrabold text-[28px] leading-tight text-ink-bright line-clamp-2 break-words"
            >
              {product.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-stretch gap-2">
            <div className="rounded-control bg-slate-ground px-3.5 py-2 flex flex-col justify-center">
              <p className="text-label uppercase text-ink-label">Worth</p>
              <p className="font-mono text-[17px] font-semibold text-units-amber-text whitespace-nowrap">
                <span id="planWorth">{worth ? worth.toLocaleString() : 'not on the wiki'}</span>
                {worth > 0 && <span className="text-[13px]"> U</span>}
                {ratio && (
                  <span className="ml-2 text-[12px] text-[#fde68a]">
                    <span className="sr-only">, worth </span>×{ratio}
                    <span className="sr-only"> its raw inputs</span>
                  </span>
                )}
              </p>
            </div>
            <Quantity qty={qty} max={maxQty} onQty={onQty} />
            <button
              type="button"
              aria-expanded={changing}
              aria-controls="planChange"
              onClick={() => {
                setChanging(!changing);
              }}
              className="self-center h-10 px-3.5 rounded-control border border-control-edge bg-slate-ground inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink hover:border-control-edge-hover"
            >
              <i className="ph-bold ph-magnifying-glass" aria-hidden="true" />
              Change item
            </button>
          </div>
          {changing && <div className="basis-full">{changeItem}</div>}
        </header>

        <div
          aria-hidden="true"
          className="grid gap-1.5 px-[22px] pb-4"
          style={{ gridTemplateColumns: `repeat(${String(path.steps.length)}, minmax(0, 1fr))` }}
        >
          {path.steps.map((step, i) => (
            <i key={i} className={`h-1 rounded-full ${BAR[step.state]}`} />
          ))}
        </div>

        <ol
          id="planPath"
          ref={board}
          className="flex-1 min-h-0 grid gap-3 overflow-y-auto px-[22px] pb-[22px]"
          style={{ gridTemplateColumns: columns }}
        >
          {path.steps.map((step, i) => (
            <li
              key={i}
              data-step={step.kind}
              aria-current={step.state === 'now' ? 'step' : undefined}
              // In one row each column scrolls on its own; wrapped onto rows, the board scrolls.
              className={`${COLUMN} ${oneRow ? 'min-h-0 overflow-y-auto' : 'self-start'}`}
            >
              {step.kind === 'gather' ? (
                <>
                  <Head title="Gather" meta={`${String(gathered)} / ${String(plan.raw.length)}`} />
                  <ul id="planCargo" className="flex flex-col">
                    {plan.raw.map(entry => {
                      const key = rawKey(entry.title, entry.qty);
                      const done = ticked.has(key);
                      return (
                        <li
                          key={entry.title}
                          data-raw={entry.title}
                          data-qty={entry.qty}
                          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 py-1.5"
                        >
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={() => {
                              onToggle(key);
                            }}
                            aria-label={`Gathered ${formatQty(entry.qty)} ${entry.title}`}
                            className="w-[18px] h-[18px] accent-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              onOpen(entry.title);
                            }}
                            aria-label={`${entry.title}: open in Codex`}
                            className={`min-w-0 text-left text-[14px] leading-snug rounded-[4px] px-1 -mx-1 ${
                              done
                                ? 'line-through text-ink-muted'
                                : 'text-ink underline decoration-dotted underline-offset-4'
                            } ${peek === entry.title ? LIT : ''}`}
                          >
                            {entry.title}
                          </button>
                          <span className="font-mono text-[13px] text-quantity-cyan">{formatQty(entry.qty)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : step.kind === 'round' ? (
                <>
                  <Head
                    title={`Round ${String(step.round + 1)}`}
                    meta={`${String(plan.rounds[step.round]?.length ?? 0)} craft${plan.rounds[step.round]?.length === 1 ? '' : 's'}`}
                  />
                  <ul className="flex flex-col gap-1.5">
                    {(plan.rounds[step.round] ?? []).map(item => {
                      const name = item.qty > 1 ? `${item.title} ×${formatQty(item.qty)}` : item.title;
                      return (
                        <li key={item.title}>
                          <button
                            type="button"
                            onClick={() => {
                              onOpen(item.title);
                            }}
                            aria-label={`${name}: open in Codex`}
                            className={`${ITEM} ${peek === item.title ? LIT : ''}`}
                          >
                            {name}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <Done
                    done={step.state === 'done'}
                    label={step.state === 'done' ? 'Crafted' : 'Mark crafted'}
                    onToggle={() => {
                      onRound(step.round);
                    }}
                  />
                </>
              ) : (
                <>
                  <Head
                    title={product.recipe.type === 'cook' ? 'Final cook' : 'Final craft'}
                    meta={formatQty(product.qty)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onOpen(product.title);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-[calc(var(--radius-control)-4px)] bg-[rgba(245,158,11,0.1)] shadow-[inset_0_0_0_1px_rgba(251,191,36,0.5)] flex flex-col gap-1 ${
                      peek === product.title ? LIT : ''
                    }`}
                  >
                    <span className="font-semibold text-[15px] text-[#fde68a] break-words">{product.title}</span>
                    <span className="text-[13px] leading-snug text-ink-soft break-words">
                      {product.inputs
                        .map(input => `${input.qty > 1 ? `${formatQty(input.qty)} ` : ''}${input.title}`)
                        .join(' + ')}
                      <span className="sr-only">: open in Codex</span>
                    </span>
                  </button>
                  <Done
                    done={step.state === 'done'}
                    label={step.state === 'done' ? 'Crafted' : 'Mark crafted'}
                    onToggle={onFinal}
                  />
                </>
              )}
            </li>
          ))}
        </ol>
      </section>

      <CodexPeekDock catalog={catalog} plan={plan} title={peek} switcher={switcher}>
        <p className="mt-auto pt-2 text-caption text-ink-label">
          Recipes from the NMS wiki ({product.title}, revision {product.item?.revId}).{' '}
          {choices ? 'Your recipe choices are used.' : 'The planner uses each item’s first recipe.'}
        </p>
      </CodexPeekDock>
    </div>
  );
}

function Head({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
      <h2 className="font-display font-bold text-[14px] text-ink-bright whitespace-nowrap">{title}</h2>
      <span className="font-mono text-[11px] text-ink-muted whitespace-nowrap">{meta}</span>
    </div>
  );
}

function Done({ done, label, onToggle }: { done: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={done}
      onClick={onToggle}
      className={`mt-auto self-start inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[calc(var(--radius-control)-4px)] text-[12px] font-semibold whitespace-nowrap ${
        done
          ? 'bg-ready-emerald-tint text-ready-emerald-text'
          : 'bg-[rgba(30,41,59,0.6)] text-ink-soft hover:text-ink-bright'
      }`}
    >
      <i className={`ph-bold ${done ? 'ph-check' : 'ph-hammer'}`} aria-hidden="true" />
      {label}
    </button>
  );
}

function Quantity({ qty, max, onQty }: { qty: number; max: number; onQty: (qty: number) => void }) {
  const [text, setText] = useState(String(qty));
  const [prev, setPrev] = useState(qty);
  if (prev !== qty) {
    setPrev(qty);
    setText(String(qty));
  }
  const step = 'w-7 h-7 rounded-[4px] grid place-items-center text-ink-soft hover:text-ink-bright disabled:opacity-40';
  return (
    <div className="rounded-control bg-slate-ground px-3 py-2 flex flex-col justify-center">
      <label htmlFor="planQty" className="text-label uppercase text-ink-label">
        Quantity
      </label>
      <div className="flex items-center gap-1">
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
          max={max}
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
            setText(String(Math.max(1, Math.min(max, Math.round(value) || qty))));
          }}
          className="w-12 h-7 bg-transparent text-center font-mono text-[16px] font-semibold text-ink-bright [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none focus:outline-hidden focus-visible:shadow-[inset_0_0_0_1.5px_var(--color-scanner-cyan-glow)] rounded-[4px]"
        />
        <button
          type="button"
          aria-label="One more"
          disabled={qty >= max}
          onClick={() => {
            onQty(qty + 1);
          }}
          className={step}
        >
          <i className="ph-bold ph-plus" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
