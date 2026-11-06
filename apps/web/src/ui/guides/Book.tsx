// One book of the playbook (design 18): its milestones, a rule cited from the wiki where the book leans on one, the
// player's notes pinned to it, then the chapter itself and the way to its neighbours. All six stay mounted (hidden by
// the section routing) so the header search can find and scroll to text in any of them.
import { useEffect, type ReactNode } from 'react';
import { BOOKS, guideProgress, type BookKey } from '@atlas/core/guides';
import { noteExcerpt, notesPinnedTo } from '@atlas/core/notes';
import type { FactId } from '@atlas/core/facts';
import { Book1 } from './books/Book1.tsx';
import { Book2 } from './books/Book2.tsx';
import { Book3 } from './books/Book3.tsx';
import { Book4 } from './books/Book4.tsx';
import { Book5 } from './books/Book5.tsx';
import { Book6 } from './books/Book6.tsx';
import { Milestones } from './Checklist.tsx';
import { TOP_BUTTON } from './guide-bits.ts';
import { useAppState } from '../useAppState.ts';
import { goBack, useSection } from '../shell/section-store.ts';
import { newNote, openNote } from '../notes/note-nav.ts';
import { loadFacts, useFacts } from '../gear/facts-store.ts';
import { useMedia } from '../parts/useMedia.ts';

const CONTENT: Record<BookKey, () => ReactNode> = {
  book1: Book1,
  book2: Book2,
  book3: Book3,
  book4: Book4,
  book5: Book5,
  book6: Book6
};
// The cited rule a book's milestones turn on (wiki/facts.json); a book without one shows no wiki card.
const BOOK_FACT: Partial<Record<BookKey, FactId>> = { book3: 'supercharged-per-class' };
const CARD = 'rounded-card bg-panel-glass border border-hairline p-4 flex flex-col gap-3';
const H2 = 'font-display font-bold text-[15px] text-ink-bright flex items-center gap-2';

export function Book({ book }: { book: BookKey }) {
  const state = useAppState();
  const index = BOOKS.findIndex(item => item.key === book);
  const meta = BOOKS[index];
  const prev = BOOKS[index - 1];
  const next = BOOKS[index + 1];
  const Content = CONTENT[book];
  const { done, total } = guideProgress(state.checklists).perBook[book];
  const label = `Book ${meta?.numeral ?? ''}`;
  const wide = useMedia('(min-width: 1024px)');

  // The Workbench (round 6, d12): the chapter in the main column at reading width, its neighbours at the top, and the
  // milestones, the wiki's rule and the player's notes in the inspector.
  if (wide) {
    const pager = (to: (typeof BOOKS)[number] | undefined, dir: 'prev' | 'next') =>
      to && (
        <a
          href={`#${to.key}`}
          title={`Book ${to.numeral}: ${to.title}`}
          className="h-10 px-3 rounded-control border border-control-edge bg-slate-ground inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink whitespace-nowrap hover:border-control-edge-hover"
        >
          {dir === 'prev' && <i className="ph-bold ph-caret-left" aria-hidden="true" />}
          <span className="sr-only">{dir === 'prev' ? 'Previous: ' : 'Next: '}</span>Book {to.numeral}
          {dir === 'next' && <i className="ph-bold ph-caret-right" aria-hidden="true" />}
        </a>
      );
    return (
      <div className="book-desk detail-pane h-full">
        <div className="detail-split min-h-full">
          <article
            aria-labelledby={`${book}-title`}
            className="min-w-0 px-[22px] @[56rem]:px-[30px] py-6 flex flex-col gap-5"
          >
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1 min-w-[min(100%,18rem)] flex flex-col gap-1.5">
                <p className="font-mono text-[12px] tracking-[0.16em] uppercase text-scanner-cyan-pale">{label}</p>
                <h1
                  id={`${book}-title`}
                  className="font-display font-extrabold text-[24px] @[48rem]:text-[30px] leading-tight text-ink-bright break-words"
                >
                  {meta?.title}
                </h1>
                <p className="text-sub text-ink-muted">{meta?.blurb}</p>
              </div>
              <nav aria-label="More guides" className="flex gap-2 shrink-0">
                {pager(prev, 'prev')}
                {pager(next, 'next')}
              </nav>
            </header>
            <section aria-labelledby={`${book}-chapter`} className="reading flex flex-col gap-6">
              <h2 id={`${book}-chapter`} className="sr-only">
                The chapter
              </h2>
              <Content />
            </section>
          </article>
          <aside
            aria-label={`${label}: milestones, the wiki and your notes`}
            className="detail-side min-w-0 px-[22px] py-[18px] flex flex-col gap-6"
          >
            <Milestones book={book} desk />
            <WikiRule book={book} desk />
            <PinnedToBook book={book} label={label} desk />
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl pt-[env(safe-area-inset-top)]">
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              goBack('guides');
            }}
            aria-label="Back"
            className={TOP_BUTTON}
          >
            <i className="ph-bold ph-caret-left text-lg" aria-hidden="true" />
          </button>
          <span className="h-7 px-3 rounded-full grid place-items-center bg-ready-emerald-tint border border-ready-emerald-edge-soft font-mono text-[12px] text-ready-emerald-text">
            {done} of {total}
            <span className="sr-only"> milestones ticked</span>
          </span>
        </div>
        <p className="text-label uppercase text-ink-label mt-4">{label}</p>
        <h1 className="font-display text-screen-title text-ink-bright">{meta?.title}</h1>
        <p className="text-sub text-ink-muted">{meta?.blurb}</p>
      </header>

      <Milestones book={book} />
      <WikiRule book={book} />
      <PinnedToBook book={book} label={label} />

      <section aria-labelledby={`${book}-chapter`} className="flex flex-col gap-4">
        <h2 id={`${book}-chapter`} className={`${H2} pt-2`}>
          <i className="ph-bold ph-book-open-text text-scanner-cyan-pale" aria-hidden="true" />
          The chapter
        </h2>
        <Content />
      </section>

      <nav aria-label="More guides" className="grid grid-cols-2 gap-3 pt-2">
        {prev ? (
          <a href={`#${prev.key}`} className="book-pager text-left">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <i className="ph-bold ph-arrow-left" aria-hidden="true" />
              Book {prev.numeral}
            </span>
            <span className="block text-sm text-white truncate">{prev.title}</span>
          </a>
        ) : (
          <span />
        )}
        {next && (
          <a href={`#${next.key}`} className="book-pager text-right">
            <span className="text-xs text-slate-400 flex items-center justify-end gap-1">
              Book {next.numeral}
              <i className="ph-bold ph-arrow-right" aria-hidden="true" />
            </span>
            <span className="block text-sm text-white truncate">{next.title}</span>
          </a>
        )}
      </nav>
    </div>
  );
}

// The wiki's own sentence, quoted as the sync checked it against the archived page (ADR-0003), with its revision.
function WikiRule({ book, desk = false }: { book: BookKey; desk?: boolean }) {
  const id = BOOK_FACT[book];
  const open = useSection() === book;
  const facts = useFacts();
  useEffect(() => {
    if (id && open) void loadFacts();
  }, [id, open]);
  const fact = id ? facts?.facts[id] : undefined;
  if (!fact) return null;
  return (
    <section
      aria-labelledby={`${book}-wiki`}
      className={desk ? 'flex flex-col gap-3' : `${CARD} border-scanner-cyan-edge`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={`${book}-wiki`} className={H2}>
          <i className="ph-bold ph-book-bookmark text-scanner-cyan-pale" aria-hidden="true" />
          From the wiki
        </h2>
        <span className="h-6 px-2.5 rounded-full grid place-items-center bg-slate-ground border border-control-edge text-[11px] font-semibold text-ink-soft">
          cited
        </span>
      </div>
      <blockquote className="text-[15px] leading-relaxed text-ink-bright">“{fact.quote}”</blockquote>
      <p className="font-mono text-[11px] text-ink-label">
        <a
          href={`wiki/#/a/${encodeURIComponent(fact.path)}`}
          className="text-scanner-cyan-pale hover:text-quantity-cyan underline underline-offset-2"
        >
          {fact.page}
        </a>{' '}
        · NMS wiki · revision {fact.revId}
      </p>
    </section>
  );
}

// The player's notes pinned to the book: marked as theirs and out of the header search's book index (data-player), so
// their text never reads as the guide's.
function PinnedToBook({ book, label, desk = false }: { book: BookKey; label: string; desk?: boolean }) {
  const notes = notesPinnedTo(useAppState().notes, book);
  return (
    <section data-player aria-labelledby={`pinned-${book}`} className={desk ? 'flex flex-col gap-3' : CARD}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={`pinned-${book}`} className={H2}>
          <i className="ph-bold ph-push-pin text-scanner-cyan-pale" aria-hidden="true" />
          Pinned notes
        </h2>
        <button
          type="button"
          onClick={() => {
            newNote([book]);
          }}
          aria-label={`Add a note to ${label}`}
          className="h-9 px-3 rounded-control border border-control-edge text-caption font-semibold text-ink-soft hover:text-ink-bright flex items-center gap-1.5"
        >
          <i className="ph-bold ph-plus" aria-hidden="true" />
          Add
        </button>
      </div>
      {notes.length ? (
        <ul className="-my-1">
          {notes.map(note => (
            <li key={note.id} data-note={note.id}>
              <button
                type="button"
                onClick={() => {
                  openNote(note.id);
                }}
                className="w-full flex items-center gap-3 py-2 text-left"
              >
                <i className="ph-bold ph-file-text text-lg text-scanner-cyan-pale shrink-0" aria-hidden="true" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-semibold text-ink-bright truncate">{note.title}</span>
                  {noteExcerpt(note, 60) && (
                    <span className="block text-caption text-ink-muted truncate">{noteExcerpt(note, 60)}</span>
                  )}
                </span>
                <i className="ph-bold ph-caret-right text-ink-label shrink-0" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-caption text-ink-muted">
          Keep your own findings here (your layouts, routes, what worked): pin a note to this book.
        </p>
      )}
    </section>
  );
}
