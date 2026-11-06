// The note editor's formatting toolbar (design 11): each button rewrites the Markdown around the selection and says
// where the selection goes next. Wrapping marks toggle (bold on bold text removes it); line marks act on every line the
// selection touches.
export type MarkdownFormat = 'heading' | 'bold' | 'italic' | 'list' | 'numbered' | 'task' | 'table' | 'link';
export interface MarkdownEdit {
  text: string;
  start: number;
  end: number;
}

const WRAP: Partial<Record<MarkdownFormat, [string, string]>> = {
  bold: ['**', '**'],
  italic: ['_', '_'],
  link: ['[[', ']]'] // a Codex link: notes render [[Name]] as a search for that page
};
const TABLE = '| Column | Column |\n| --- | --- |\n|  |  |';

function wrap(text: string, start: number, end: number, [open, close]: [string, string]): MarkdownEdit {
  if (text.slice(start - open.length, start) === open && text.slice(end, end + close.length) === close)
    return {
      text: text.slice(0, start - open.length) + text.slice(start, end) + text.slice(end + close.length),
      start: start - open.length,
      end: end - open.length
    };
  return {
    text: text.slice(0, start) + open + text.slice(start, end) + close + text.slice(end),
    start: start + open.length,
    end: end + open.length
  };
}

// Applies `edit` to every line from the one holding `start` to the one holding `end`, keeping the selection over them.
function lines(text: string, start: number, end: number, edit: (lines: string[]) => string[]): MarkdownEdit {
  const from = text.lastIndexOf('\n', start - 1) + 1;
  const stop = text.indexOf('\n', end);
  const to = stop === -1 ? text.length : stop;
  const changed = edit(text.slice(from, to).split('\n')).join('\n');
  return { text: text.slice(0, from) + changed + text.slice(to), start: from, end: from + changed.length };
}

export function applyMarkdown(text: string, start: number, end: number, format: MarkdownFormat): MarkdownEdit {
  const marks = WRAP[format];
  if (marks) return wrap(text, start, end, marks);
  if (format === 'heading')
    return lines(text, start, end, all =>
      all.every(line => /^#{1,6} /.test(line))
        ? all.map(line => line.replace(/^#{1,6} /, ''))
        : all.map(line => `## ${line}`)
    );
  if (format === 'list')
    return lines(text, start, end, all =>
      all.every(line => line.startsWith('- ')) ? all.map(line => line.slice(2)) : all.map(line => `- ${line}`)
    );
  if (format === 'numbered')
    return lines(text, start, end, all =>
      all.every(line => /^\d+\. /.test(line))
        ? all.map(line => line.replace(/^\d+\. /, ''))
        : all.map((line, i) => `${String(i + 1)}. ${line}`)
    );
  if (format === 'task')
    return lines(text, start, end, all =>
      all.every(line => /^- \[[ x]\] /.test(line))
        ? all.map(line => line.slice(6))
        : all.map(line => `- [ ] ${line.replace(/^- /, '')}`)
    );
  // A table goes on its own lines after the selection, its first header selected to type over.
  const before = text.slice(0, end);
  const lead = before === '' ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const at = end + lead.length + 2;
  return { text: `${before}${lead}${TABLE}\n${text.slice(end)}`, start: at, end: at + 'Column'.length };
}
