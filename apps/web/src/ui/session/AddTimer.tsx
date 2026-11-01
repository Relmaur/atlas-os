// The add-timer forms, one per kind (the Session screen's + Refiner, + Crop, + Custom open them in a sheet): a refiner run (its time is the wiki's refining time × whole batches), a crop (your harvest time,
// remembered per crop) or anything else (your time).
import { useMemo, useState } from 'react';
import { refineItemAsked } from './sheet-store.ts';
import { formatCountdown } from '@atlas/core/format';
import {
  MAX_TIMER_MS,
  lastCropMinutes,
  recipeInputs,
  refineDuration,
  refineOptions,
  type TimerKind
} from '@atlas/core/timers';
import { Button } from '../parts/Button.tsx';
import { addTimer } from '../actions.ts';
import { useGameData } from '../calculators/game-data.ts';
import { useAppState } from '../useAppState.ts';
import { askToNotify } from './timer-runner.ts';

const FIELD =
  'w-full h-11 rounded-control border border-control-edge bg-slate-ground px-3.5 text-base md:text-sm text-ink-bright placeholder:text-ink-disabled focus:border-scanner-cyan-edge-strong focus:outline-hidden';
const QUICK = [5, 15, 30, 60];

function start(kind: TimerKind, label: string, ms: number): void {
  askToNotify(); // from this tap, the one place a browser lets the app ask
  addTimer(kind, label, ms);
}

export function RefineForm({ onStarted }: { onStarted: () => void }) {
  const data = useGameData();
  const options = useMemo(() => (data.status === 'ready' ? refineOptions(data.catalog.byTitle.values()) : []), [data]);
  const [name, setName] = useState(refineItemAsked);
  const [pick, setPick] = useState(0);
  const [amount, setAmount] = useState('250');
  const option = options.find(item => item.title.toLowerCase() === name.trim().toLowerCase());
  const recipe = option?.recipes[Math.min(pick, option.recipes.length - 1)];
  const qty = Math.floor(Number(amount));
  const ms = recipe ? refineDuration(recipe, qty) : null;
  const tooLong = ms !== null && ms > MAX_TIMER_MS;

  if (data.status === 'failed')
    return (
      <p className="text-sm text-amber-200">
        The wiki’s recipes couldn’t be loaded, so refiner times aren’t available. Use a custom timer.
      </p>
    );
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={event => {
        event.preventDefault();
        if (!option || ms === null) return;
        start('refine', `${qty.toLocaleString()} ${option.title}`, ms);
        onStarted();
      }}
    >
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <label className="block">
          <span className="block text-caption text-ink-soft mb-1.5">What it makes</span>
          <input
            type="text"
            list="refineItems"
            value={name}
            onChange={event => {
              setName(event.target.value);
              setPick(0);
            }}
            placeholder={data.status === 'ready' ? 'Pick what it makes' : 'Loading recipes…'}
            autoComplete="off"
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className="block text-caption text-ink-soft mb-1.5">Amount made</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={amount}
            onChange={event => {
              setAmount(event.target.value);
            }}
            className={`${FIELD} font-mono tabular-nums`}
          />
        </label>
      </div>
      <datalist id="refineItems">
        {options.map(item => (
          <option key={item.title} value={item.title} />
        ))}
      </datalist>
      {option && option.recipes.length > 1 && (
        <label className="block">
          <span className="block text-caption text-ink-soft mb-1.5">Recipe</span>
          <select
            value={pick}
            onChange={event => {
              setPick(Number(event.target.value));
            }}
            className={FIELD}
          >
            {option.recipes.map((item, i) => (
              <option key={i} value={i}>
                {recipeInputs(item)}
              </option>
            ))}
          </select>
        </label>
      )}
      {recipe && ms !== null && (
        <p className="text-caption text-ink-muted">
          <span className="font-mono text-cyan-300 tabular-nums">{formatCountdown(ms)}</span> from{' '}
          {recipeInputs(recipe)}, at the wiki’s refining time ({String(recipe.seconds)} s per unit made).
        </p>
      )}
      {name.trim() && !option && data.status === 'ready' && (
        <p className="text-caption text-ink-muted">Pick something a refiner makes from the list.</p>
      )}
      {tooLong && <TooLong />}
      <Button variant="primary" type="submit" icon="ph-play" wide disabled={!option || ms === null || tooLong}>
        Start refiner timer
      </Button>
    </form>
  );
}

export function TimedForm({ kind, onStarted }: { kind: 'crop' | 'custom'; onStarted: () => void }) {
  const { timers } = useAppState();
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState('');
  const crop = kind === 'crop';
  const total = Number(minutes);
  const tooLong = total * 60_000 > MAX_TIMER_MS;
  const valid = name.trim() !== '' && total > 0 && !tooLong;
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={event => {
        event.preventDefault();
        if (!valid) return;
        start(kind, name.trim(), total * 60_000);
        onStarted();
      }}
    >
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <label className="block">
          <span className="block text-caption text-ink-soft mb-1.5">{crop ? 'Crop' : 'Name'}</span>
          <input
            type="text"
            value={name}
            onChange={event => {
              setName(event.target.value);
              // A crop starts from the time you last set for it.
              const last = crop ? lastCropMinutes(timers, event.target.value) : null;
              if (last !== null) setMinutes(String(last));
            }}
            placeholder={crop ? 'Crop name' : 'What you’re waiting on'}
            autoComplete="off"
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className="block text-caption text-ink-soft mb-1.5">Minutes</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={minutes}
            onChange={event => {
              setMinutes(event.target.value);
            }}
            className={`${FIELD} font-mono tabular-nums`}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick times">
        {QUICK.map(value => (
          <button
            key={value}
            type="button"
            aria-pressed={total === value}
            onClick={() => {
              setMinutes(String(value));
            }}
            className="quick-chip"
          >
            {value < 60 ? `${String(value)}m` : '1h'}
          </button>
        ))}
      </div>
      <p className="text-caption text-ink-muted">
        {crop
          ? 'Your harvest time: the wiki only gives it in prose, so you set it, and the next one starts from it.'
          : 'Your time, for anything: a frigate mission, a settlement job, a storm.'}
      </p>
      {tooLong && <TooLong />}
      <Button variant="primary" type="submit" icon="ph-play" wide disabled={!valid}>
        {crop ? 'Start crop timer' : 'Start timer'}
      </Button>
    </form>
  );
}

function TooLong() {
  return <p className="text-xs text-amber-200">A timer can run up to 30 days.</p>;
}
