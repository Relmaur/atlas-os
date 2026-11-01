// An article (design 16): Back, On this page and Pin to a note up top, the symbol and title, the summary, an "On this
// page" list, then each of the wiki's sections as a card (Quick Facts as pairs, recipe lines as a table), the pages
// it's used in and links to, and the source and licence. Mid-scroll (33), below lg, a bar takes the header's place
// with the current section as a pill that opens the On this page sheet (find in this article, every section with its
// size, % read); a back-to-top button floats above the search key. From lg the same list is a sticky right rail.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { DEFAULTS, browseHref, headingIds, relations, type CodexIndex } from '@atlas/core/codex';
import { quickFacts, recipeRows, sectionSize, splitSections, type RecipeRow } from '@atlas/core/article-sections';
import type { PreparedEntry } from '@atlas/core/search';
import { showToast } from '../../app/ui.ts';
import { WikiSearch } from '../../app/wiki-data.js';
import { buttonClass } from '../parts/Button.tsx';
import { SheetGrab, useSheetDrag, useSheetOpen } from '../parts/Sheet.tsx';
import { categoryIcon, categoryLabel, formatDate } from './bits.tsx';
import { loadCodex } from './codex-data.ts';
import { renderMarkdown } from './markdown.ts';
import { goBack, navigate } from './route.ts';

const LIST_LIMIT = 12;
const RECIPES_SHOWN = 5;
const TOP_BUTTON =
  'w-11 h-11 shrink-0 rounded-control bg-slate-ground border border-control-edge grid place-items-center text-ink hover:border-control-edge-hover';
const CARD = 'rounded-card bg-panel-glass border border-hairline p-4 flex flex-col gap-3 scroll-mt-28';
const SECTION_ICON: Record<string, string> = {
  'quick facts': 'ph-info',
  source: 'ph-map-pin',
  sources: 'ph-map-pin',
  acquisition: 'ph-map-pin',
  summary: 'ph-text-align-left',
  'game description': 'ph-quotes',
  'additional information': 'ph-lightbulb',
  'release history': 'ph-clock-counter-clockwise',
  'used in': 'ph-arrow-bend-up-right',
  'links to': 'ph-link-simple',
  'mentioned in': 'ph-quotes'
};
const MACHINE_TITLE: Record<string, string> = {
  Refiner: 'Refiner recipes',
  Crafting: 'Crafting recipes',
  'Nutrient Processor': 'Cooking recipes'
};

// The wiki fields the article shows (the index keeps unknown fields as `unknown`).
const text = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
const revision = (entry: PreparedEntry) => (typeof entry.revId === 'number' ? entry.revId : undefined);
const permalink = (entry: PreparedEntry) => `${text(entry.url) ?? ''}?oldid=${String(revision(entry))}`;
const copyDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const smooth = (): ScrollBehavior => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
// A Markdown fragment (a recipe's inputs, a fact) as inline HTML: rendered and sanitised, its paragraph unwrapped.
const inline = (markdown: string, index: CodexIndex, q: string) =>
  renderMarkdown(markdown, index, q)
    .html.trim()
    .replace(/^<p>([\s\S]*)<\/p>$/, '$1');

interface Part {
  id: string;
  title: string;
  size: string;
}

export function Article({
  index,
  path,
  q,
  copyDate
}: {
  index: CodexIndex;
  path: string;
  q: string;
  /** The wiki dump the archive was taken from (verification.json's dumpDate), when known. */
  copyDate?: string | undefined;
}) {
  const entry = index.byPath.get(path);
  const href = (target: string) => `#/a/${encodeURIComponent(target)}${q ? `?q=${encodeURIComponent(q)}` : ''}`;
  const split = useMemo(() => splitSections(entry?.body ?? ''), [entry]);
  const ids = useMemo(() => headingIds(split.sections.map(section => section.title)), [split]);
  const related = useMemo(() => (entry ? relations(index, entry) : null), [entry, index]);
  const facts = useMemo(() => {
    const section = split.sections.find(item => item.title.toLowerCase() === 'quick facts');
    return new Map(section ? (quickFacts(section.markdown)?.facts ?? []) : []);
  }, [split]);
  const [sheet, setSheet] = useState<'list' | 'find' | null>(null);
  const closeSheet = useCallback(() => {
    setSheet(null);
  }, []);
  const [find, setFind] = useState('');
  const [hits, setHits] = useState<HTMLElement[]>([]);
  const [hit, setHit] = useState(-1);
  const header = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const past = useScrolledPast(header);
  useEffect(() => {
    if (!body.current) return;
    setHits(markMatches(body.current, find));
    setHit(-1);
  }, [find, entry]);
  // The next match: the sheet closes so it can be seen.
  const nextHit = () => {
    if (!hits.length) return;
    const i = (hit + 1) % hits.length;
    setHit(i);
    hits.forEach((mark, j) => mark.classList.toggle('is-current', j === i));
    setSheet(null);
    hits[i]?.scrollIntoView({ block: 'center', behavior: smooth() });
  };

  useEffect(() => {
    document.title = `${entry?.title ?? 'Article not found'} · Wiki Codex`;
    picked = null;
    window.scrollTo({ top: 0 });
  }, [entry]);

  const fallback = q ? browseHref({ ...DEFAULTS, q }) : '#/';
  if (!entry || !related)
    return (
      <article className="min-w-0 flex flex-col gap-section max-w-2xl">
        <BackButton fallback={fallback} />
        <header id="articleHeader">
          <h1 className="font-display text-screen-title text-ink-bright">Article not found</h1>
        </header>
        <div id="articleBody" className="md-body">
          <p>
            No article at <code>{path}</code>. It may have been renamed by a re-sync. <a href="#/">Back to the Codex</a>
            .
          </p>
        </div>
      </article>
    );

  const lists: [string, string, PreparedEntry[]][] = [
    ['usedIn', 'Used in', related.usedIn],
    ['linksTo', 'Links to', related.linksTo],
    ['mentionedIn', 'Mentioned in', related.mentionedIn],
    ['nearby', `More in ${categoryLabel(entry.category)}`, related.nearby]
  ];
  const parts: Part[] = [
    { id: 'articleTop', title: 'Overview', size: 'top' },
    ...split.sections.map((section, i) => ({ id: ids[i] ?? '', title: section.title, size: sectionSize(section) })),
    ...lists
      .filter(([, , list]) => list.length)
      .map(([key, title, list]) => ({
        id: `rel-${key}`,
        title,
        size: `${String(list.length)} page${list.length === 1 ? '' : 's'}`
      })),
    ...(text(entry.url) ? [{ id: 'articleSource', title: 'Source & licence', size: 'wiki' }] : [])
  ];
  const symbol = facts.get('Symbol') ?? '';
  const kind = [categoryLabel(entry.category), facts.get('Category')].filter(Boolean).join(' · ');
  const goTo = (id: string) => {
    setSheet(null);
    pickPart(id);
    if (id === 'articleTop') window.scrollTo({ top: 0, behavior: smooth() });
    else document.getElementById(id)?.scrollIntoView({ behavior: smooth() });
  };
  const removeDraft = () => {
    WikiSearch.writeDrafts(WikiSearch.readDrafts().filter(draft => draft.path !== entry.path));
    navigate('#/'); // first, so the reload doesn't flash "Article not found"
    void loadCodex().then(() => {
      showToast('Draft removed.');
    });
  };
  const copyLink = () => {
    const url = location.href;
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(url)) // missing outside a secure context: the toast shows the link
      .then(() => {
        showToast('Link copied.');
      })
      .catch(() => {
        showToast(url);
      });
  };
  const onThisPage = (onFind: boolean) => (
    <OnThisPage
      parts={parts}
      find={find}
      hits={hits.length}
      started={hit !== -1}
      onFind={setFind}
      onNext={nextHit}
      focusFind={onFind}
      onGo={goTo}
    />
  );

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_16rem] xl:gap-12">
      <article className="min-w-0 flex flex-col gap-section max-w-2xl lg:max-w-[720px]">
        <header ref={header} id="articleHeader" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <BackButton fallback={fallback} />
            <span className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setSheet('list');
                }}
                aria-label="On this page"
                aria-haspopup="dialog"
                className={`${TOP_BUTTON} xl:hidden`}
              >
                <i className="ph-bold ph-list-bullets text-lg" aria-hidden="true" />
              </button>
              <a
                href={`../#note-about/${encodeURIComponent(entry.title)}`}
                aria-label="Pin to a note"
                title="Start a note about this page"
                className={TOP_BUTTON}
              >
                <i className="ph-bold ph-push-pin text-lg" aria-hidden="true" />
              </a>
            </span>
          </div>
          <div className="flex items-center gap-3.5">
            <span
              aria-hidden="true"
              className="w-[60px] h-[60px] shrink-0 rounded-[16px] grid place-items-center font-mono text-[22px] font-semibold bg-[rgba(34,211,238,0.08)] border border-[rgba(34,211,238,0.4)] text-[#a5f3fc]"
            >
              {symbol || <i className={`ph-bold ${categoryIcon(entry.category)}`} />}
            </span>
            <div className="min-w-0">
              <p className="text-label uppercase text-ink-label">{kind}</p>
              <h1 className="font-display font-extrabold text-[24px] leading-tight text-ink-bright break-words">
                {entry.title}
              </h1>
            </div>
          </div>
          {entry.removed ? (
            <p className="rounded-control border border-danger-rose-edge bg-danger-rose-tint px-3 py-2 text-sub text-danger-rose-text">
              This page has been removed from the wiki. You’re reading the last archived copy.
            </p>
          ) : entry.obsolete ? (
            <p className="rounded-control border border-control-edge bg-slate-ground px-3 py-2 text-sub text-ink">
              No longer in the game: the wiki keeps this page for an older version.
            </p>
          ) : null}
        </header>

        <div ref={body} id="articleBody" className="flex flex-col gap-section">
          {entry.summary ? <p className="text-[15px] leading-relaxed text-ink">{entry.summary}</p> : null}
          {split.intro ? <Markdown markdown={split.intro} index={index} q={q} prefix="intro-" /> : null}
          {parts.length > 2 && (
            <nav aria-label="On this page" className="xl:hidden rounded-card border border-hairline px-4 py-3">
              <p className="text-label uppercase text-ink-label">On this page</p>
              <ol className="mt-1.5 flex flex-col">
                {parts.slice(1).map((part, i) => (
                  <li key={part.id}>
                    <a
                      href={`#${part.id}`}
                      onClick={event => {
                        event.preventDefault();
                        goTo(part.id);
                      }}
                      className="flex items-baseline gap-3 py-1.5 text-[14px] text-scanner-cyan-pale hover:text-quantity-cyan"
                    >
                      <span className="font-mono text-[11px] text-ink-label">{String(i + 2).padStart(2, '0')}</span>
                      {part.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          {split.sections.map((section, i) => (
            <Section
              key={ids[i]}
              id={ids[i] ?? ''}
              title={section.title}
              article={entry.title}
              markdown={section.markdown}
              index={index}
              q={q}
            />
          ))}

          {lists.map(([key, title, list]) =>
            list.length ? <RelationCard key={key} id={`rel-${key}`} title={title} items={list} href={href} /> : null
          )}
        </div>

        {text(entry.url) ? (
          <footer id="articleSource" className="font-mono text-[11px] leading-relaxed text-ink-label scroll-mt-28">
            NMS wiki ·{' '}
            <a
              href={permalink(entry)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              revision {String(revision(entry))}
            </a>
            {text(entry.revTimestamp) ? ` · edited ${formatDate(text(entry.revTimestamp))}` : ''}
            {text(entry.version) ? ` · up to date as of ${text(entry.version) ?? ''}` : ''} · CC BY-NC-SA 3.0
            {copyDate ? ` · wiki copy from ${copyDay(copyDate)}` : ''}
            <br />
            {/* Corrections belong on the wiki, where every reader gets them; the next sync brings them here. */}
            <a
              href={`${text(entry.url) ?? ''}?action=edit`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-scanner-cyan-pale"
            >
              Fix this on the wiki
            </a>
            {' · '}
            <a href={text(entry.url)} target="_blank" rel="noopener noreferrer" className="text-scanner-cyan-pale">
              Live wiki page
            </a>
            {' · '}
            <button type="button" onClick={copyLink} className="text-scanner-cyan-pale">
              Copy link
            </button>
          </footer>
        ) : null}
        {entry.source === 'draft' ? (
          <button
            type="button"
            onClick={removeDraft}
            className="self-start h-9 px-3 rounded-control border border-danger-rose-edge text-danger-rose-text hover:bg-danger-rose-tint text-caption flex items-center gap-2"
          >
            <i className="ph-bold ph-trash" aria-hidden="true" />
            Remove draft
          </button>
        ) : null}
      </article>

      <aside aria-label="Article index" className="hidden xl:block">
        <div
          id="articleRail"
          className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain pb-4"
        >
          {onThisPage(false)}
        </div>
      </aside>

      <CollapsedBar
        shown={past}
        title={entry.title}
        parts={parts}
        onOpen={() => {
          setSheet('list');
        }}
        onFind={() => {
          setSheet('find');
        }}
        fallback={fallback}
      />
      <button
        type="button"
        onClick={() => {
          picked = null;
          window.scrollTo({ top: 0, behavior: smooth() });
        }}
        aria-label="Back to top"
        aria-hidden={!past}
        tabIndex={past ? 0 : -1}
        className={`fixed z-30 right-4 bottom-[calc(var(--spacing-tabbar-inset)+var(--spacing-tabbar)+12px)] lg:bottom-6 w-12 h-12 rounded-full bg-nav-glass border border-nav-edge backdrop-blur-[18px] grid place-items-center text-ink transition-opacity ${past ? '' : 'opacity-0 pointer-events-none'}`}
      >
        <i className="ph-bold ph-arrow-up text-lg" aria-hidden="true" />
      </button>

      <IndexSheet open={sheet !== null} onClose={closeSheet}>
        {onThisPage(sheet === 'find')}
      </IndexSheet>
    </div>
  );
}

function BackButton({ fallback }: { fallback: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        goBack(fallback);
      }}
      aria-label="Back"
      className={TOP_BUTTON}
    >
      <i className="ph-bold ph-caret-left text-lg" aria-hidden="true" />
    </button>
  );
}

function Markdown({ markdown, index, q, prefix }: { markdown: string; index: CodexIndex; q: string; prefix: string }) {
  const html = useMemo(() => renderMarkdown(markdown, index, q, prefix).html, [markdown, index, q, prefix]);
  return <div data-md className="md-body" dangerouslySetInnerHTML={{ __html: html }} />;
}

function Section(props: {
  id: string;
  title: string;
  article: string;
  markdown: string;
  index: CodexIndex;
  q: string;
}) {
  const { index, q } = props;
  const facts = useMemo(() => quickFacts(props.markdown), [props.markdown]);
  const { rows, rest } = useMemo(() => recipeRows(props.markdown), [props.markdown]);
  const icon = SECTION_ICON[props.title.toLowerCase()] ?? 'ph-article';
  return (
    <section id={props.id} aria-labelledby={`${props.id}-title`} className={CARD}>
      <h2
        id={`${props.id}-title`}
        className="flex items-center gap-2.5 font-display font-bold text-[15px] text-ink-bright"
      >
        <i className={`ph-bold ${icon} text-scanner-cyan-pale`} aria-hidden="true" />
        {props.title}
      </h2>
      {facts ? (
        <>
          <dl className="grid grid-cols-2 gap-2">
            {facts.facts.map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-control bg-slate-ground border border-hairline px-3 py-2">
                <dt className="text-label uppercase text-ink-label">{label}</dt>
                <dd
                  data-md
                  className={`text-[13px] font-semibold truncate ${label === 'Value' ? 'text-units-amber-text' : 'text-ink-bright'}`}
                  dangerouslySetInnerHTML={{ __html: inline(value, index, q) }}
                />
              </div>
            ))}
          </dl>
          {facts.rest ? <Markdown markdown={facts.rest} index={index} q={q} prefix={`${props.id}-`} /> : null}
        </>
      ) : (
        <>
          {rest ? <Markdown markdown={rest} index={index} q={q} prefix={`${props.id}-`} /> : null}
          {rows.length > 0 && <Recipes rows={rows} index={index} q={q} />}
          {props.title.toLowerCase() === 'source' && rows.some(row => row.machine === 'Refiner') && (
            <a
              href={`../#refine-timer/${encodeURIComponent(props.article)}`}
              className={`${buttonClass('secondary', 'M')} w-full`}
            >
              <i className="ph-bold ph-timer" aria-hidden="true" />
              Start a refiner timer
            </a>
          )}
        </>
      )}
    </section>
  );
}

function Recipes({ rows, index, q }: { rows: RecipeRow[]; index: CodexIndex; q: string }) {
  const [all, setAll] = useState(false);
  const machine = rows.every(row => row.machine === rows[0]?.machine) ? (rows[0]?.machine ?? '') : '';
  const timed = rows.some(row => row.time);
  const shown = all ? rows : rows.slice(0, RECIPES_SHOWN);
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-label uppercase text-scanner-cyan-pale">{MACHINE_TITLE[machine] ?? 'Recipes'}</h3>
      <div className="rounded-[12px] border border-hairline overflow-x-auto bg-[#0b1325]">
        <table className="w-full border-collapse text-[13px] text-ink">
          <thead>
            <tr>
              <th className="text-left text-label uppercase text-ink-label px-2.5 py-2">Input</th>
              <th className="text-left text-label uppercase text-ink-label px-2.5 py-2">Makes</th>
              {timed && <th className="text-left text-label uppercase text-ink-label px-2.5 py-2">Per unit</th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr key={i} className="border-t border-hairline">
                <td className="px-2.5 py-2">
                  <span data-md dangerouslySetInnerHTML={{ __html: inline(row.inputs, index, q) }} />
                  {row.note && <span className="block text-[11px] text-ink-muted">{row.note}</span>}
                </td>
                <td className="px-2.5 py-2 font-mono text-quantity-cyan whitespace-nowrap">→ {row.makes}</td>
                {timed && <td className="px-2.5 py-2 font-mono text-ink-muted whitespace-nowrap">{row.time}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > RECIPES_SHOWN && (
        <button
          type="button"
          aria-expanded={all}
          onClick={() => {
            setAll(!all);
          }}
          className="self-start text-caption font-semibold text-scanner-cyan-pale hover:text-quantity-cyan"
        >
          {all ? 'Show fewer' : `${String(rows.length - RECIPES_SHOWN)} more recipes`}
        </button>
      )}
    </div>
  );
}

function RelationCard(props: { id: string; title: string; items: PreparedEntry[]; href: (path: string) => string }) {
  const [all, setAll] = useState(false);
  const shown = all ? props.items : props.items.slice(0, LIST_LIMIT);
  const icon = SECTION_ICON[props.title.toLowerCase()] ?? 'ph-squares-four';
  return (
    <section id={props.id} aria-labelledby={`${props.id}-title`} className={CARD}>
      <h2
        id={`${props.id}-title`}
        className="flex items-center gap-2.5 font-display font-bold text-[15px] text-ink-bright"
      >
        <i className={`ph-bold ${icon} text-scanner-cyan-pale`} aria-hidden="true" />
        {props.title}
        <span className="font-mono text-[12px] font-normal text-ink-muted">{props.items.length}</span>
      </h2>
      <ul className="flex flex-col">
        {shown.map(item => (
          <li key={String(item.path)}>
            <a
              href={props.href(String(item.path))}
              className="flex items-center gap-2 py-1.5 text-[14px] text-ink hover:text-ink-bright"
            >
              <i className={`ph-bold ${categoryIcon(item.category)} text-ink-label shrink-0`} aria-hidden="true" />
              <span className="truncate">{item.title}</span>
            </a>
          </li>
        ))}
      </ul>
      {props.items.length > LIST_LIMIT ? (
        <button
          type="button"
          onClick={() => {
            setAll(!all);
          }}
          aria-expanded={all}
          className="self-start text-caption font-semibold text-scanner-cyan-pale hover:text-quantity-cyan"
        >
          {all ? 'Show fewer' : `Show all ${String(props.items.length)}`}
        </button>
      ) : null}
    </section>
  );
}

// The section being read: the last one whose top has reached the line a jump lands it on (the page's scroll padding
// plus its own scroll margin), or, after a jump, the section picked until the player scrolls themselves, since the last
// few can't scroll up that far.
let picked: string | null = null;
function pickPart(id: string): void {
  picked = id;
  window.dispatchEvent(new Event('scroll'));
}
const px = (value: string) => parseFloat(value) || 0;
function useReading(parts: Part[]): { current: number; read: number } {
  const [state, setState] = useState({ current: 0, read: 0 });
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const padding = px(getComputedStyle(document.documentElement).scrollPaddingTop);
      let current = 0;
      parts.forEach((part, i) => {
        const node = document.getElementById(part.id);
        if (!node || i === 0) return;
        if (node.getBoundingClientRect().top <= padding + px(getComputedStyle(node).scrollMarginTop) + 8) current = i;
      });
      const choice = parts.findIndex(part => part.id === picked);
      const room = document.documentElement.scrollHeight - innerHeight;
      setState({
        current: choice === -1 ? current : choice,
        read: room > 0 ? Math.min(100, Math.round((scrollY / room) * 100)) : 100
      });
    };
    measure();
    const onScroll = () => {
      frame ||= requestAnimationFrame(measure);
    };
    const onOwnScroll = () => {
      picked = null;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    for (const type of ['wheel', 'touchstart', 'keydown'])
      window.addEventListener(type, onOwnScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      for (const type of ['wheel', 'touchstart', 'keydown']) window.removeEventListener(type, onOwnScroll);
      cancelAnimationFrame(frame);
    };
  }, [parts]);
  return state;
}

// True once the element has scrolled up out of view (not before it's reached).
function useScrolledPast(ref: RefObject<HTMLElement | null>): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([item]) => {
      if (item) setPast(!item.isIntersecting && item.boundingClientRect.top < 0);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return past;
}

function CollapsedBar(props: {
  shown: boolean;
  title: string;
  parts: Part[];
  onOpen: () => void;
  onFind: () => void;
  fallback: string;
}) {
  const { current, read } = useReading(props.parts);
  const part = props.parts[current];
  return (
    <div
      id="articleBar"
      aria-hidden={!props.shown}
      inert={!props.shown}
      className={`lg:hidden fixed inset-x-0 top-0 z-30 pt-[env(safe-area-inset-top)] bg-slate-deep/95 backdrop-blur-md border-b border-hairline transition-[opacity,transform] duration-200 ${props.shown ? '' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
    >
      <div className="h-16 px-4 flex items-center gap-3">
        <BackButton fallback={props.fallback} />
        <div className="flex-1 min-w-0 flex flex-col items-center gap-1">
          <b className="max-w-full truncate text-[13px] text-ink-bright">{props.title}</b>
          <button
            type="button"
            onClick={props.onOpen}
            aria-haspopup="dialog"
            aria-label={`On this page: ${part?.title ?? ''}`}
            className="max-w-full truncate h-6 px-2.5 rounded-full border border-scanner-cyan-edge bg-scanner-cyan-tint text-[11px] font-semibold text-scanner-cyan-text"
          >
            {current + 1} / {props.parts.length} · {part?.title} ▾
          </button>
        </div>
        <button type="button" onClick={props.onFind} aria-label="Find in page" className={TOP_BUTTON}>
          <i className="ph-bold ph-magnifying-glass text-lg" aria-hidden="true" />
        </button>
      </div>
      <span aria-hidden="true" className="block h-0.5 bg-scanner-cyan-glow" style={{ width: `${String(read)}%` }} />
    </div>
  );
}

// Marks every match of `term` in the article's rendered text (never React's own nodes) and returns the marks.
function markMatches(root: HTMLElement, term: string): HTMLElement[] {
  root.querySelectorAll('mark[data-find]').forEach(mark => {
    mark.replaceWith(...mark.childNodes);
  });
  root.normalize();
  const needle = term.trim().toLowerCase();
  if (needle.length < 2) return [];
  const marks: HTMLElement[] = [];
  for (const holder of root.querySelectorAll('[data-md]')) {
    const walker = document.createTreeWalker(holder, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text); // SHOW_TEXT yields only Text nodes
    for (const node of nodes) {
      const haystack = node.data.toLowerCase();
      let at = haystack.indexOf(needle);
      if (at === -1) continue;
      const pieces = document.createDocumentFragment();
      let from = 0;
      while (at !== -1) {
        pieces.append(node.data.slice(from, at));
        const mark = document.createElement('mark');
        mark.dataset.find = '';
        mark.textContent = node.data.slice(at, at + needle.length);
        pieces.append(mark);
        marks.push(mark);
        from = at + needle.length;
        at = haystack.indexOf(needle, from);
      }
      pieces.append(node.data.slice(from));
      node.replaceWith(pieces);
    }
  }
  return marks;
}

function OnThisPage(props: {
  parts: Part[];
  find: string;
  hits: number;
  started: boolean;
  onFind: (find: string) => void;
  onNext: () => void;
  focusFind: boolean;
  onGo: (id: string) => void;
}) {
  const { current, read } = useReading(props.parts);
  const field = useRef<HTMLInputElement>(null);
  const { find, hits } = props;
  useEffect(() => {
    if (props.focusFind) field.current?.focus();
  }, [props.focusFind]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display font-bold text-[15px] text-ink-bright">On this page</h2>
        <span className="font-mono text-[11px] text-ink-muted">{read}% read</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="relative block">
          <span className="sr-only">Find in this article</span>
          <i
            className="ph-bold ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-ink-label"
            aria-hidden="true"
          />
          <input
            ref={field}
            type="search"
            value={find}
            placeholder="Find in this article"
            onChange={event => {
              props.onFind(event.target.value);
            }}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                props.onNext();
              }
            }}
            className="w-full h-11 rounded-control border border-control-edge bg-slate-ground pl-9 pr-3 text-base md:text-sm text-ink-bright placeholder:text-ink-disabled focus:border-scanner-cyan-edge-strong focus:outline-hidden"
          />
        </label>
        {find.trim().length >= 2 && (
          <p className="flex items-center justify-between gap-3 text-caption text-ink-muted" role="status">
            {hits ? `${String(hits)} match${hits === 1 ? '' : 'es'}` : 'No matches'}
            {hits > 0 && (
              <button type="button" onClick={props.onNext} className="font-semibold text-scanner-cyan-pale">
                {props.started ? 'Next' : 'Show the first'}
              </button>
            )}
          </p>
        )}
      </div>
      <ol className="flex flex-col">
        {props.parts.map((part, i) => (
          <li key={part.id}>
            <a
              href={`#${part.id}`}
              aria-current={i === current ? 'true' : undefined}
              onClick={event => {
                event.preventDefault();
                props.onGo(part.id);
              }}
              className={`flex items-baseline gap-3 px-2 py-2 rounded-control text-[14px] ${
                i === current ? 'bg-scanner-cyan-tint text-scanner-cyan-text' : 'text-ink hover:text-ink-bright'
              }`}
            >
              <span className="font-mono text-[11px] text-ink-label">{String(i + 1).padStart(2, '0')}</span>
              <span className="flex-1 min-w-0 truncate">{part.title}</span>
              <small className="text-[11px] text-ink-muted shrink-0">{part.size}</small>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

// The On this page sheet below xl, where it isn't a column: the bar closes it (no ✕).
function IndexSheet(props: { open: boolean; onClose: () => void; children: ReactNode }) {
  const sheet = useRef<HTMLDivElement>(null);
  const { open, onClose } = props;
  useSheetDrag(sheet, onClose);
  useSheetOpen(open, onClose, { layout: '(max-width: 1279px)' });
  return (
    <div className="xl:hidden">
      <div
        onClick={onClose}
        className={`fixed inset-0 z-50 bg-scrim backdrop-blur-[2px] transition-opacity duration-200 ${open ? '' : 'opacity-0 pointer-events-none'}`}
      />
      <div
        ref={sheet}
        id="articleIndexSheet"
        role="dialog"
        aria-modal="true"
        aria-label="On this page"
        aria-hidden={!open}
        inert={!open}
        className={`fixed z-50 inset-x-0 bottom-0 max-h-[80dvh] flex flex-col rounded-t-sheet border-t border-control-edge bg-[#020617] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${open ? '' : 'translate-y-full'}`}
      >
        <div data-sheet-grab className="px-5 pt-3">
          <SheetGrab onClose={onClose} label="Close On this page" />
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {open ? props.children : null}
        </div>
      </div>
    </div>
  );
}
