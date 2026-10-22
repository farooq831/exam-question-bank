import { useRef, useState, type ReactNode } from 'react';
import { Extension, useEditor, EditorContent, type Editor } from '@tiptap/react';
import { Plugin, TextSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import OrderedList from '@tiptap/extension-ordered-list';
import { LIST_STYLE_LABELS, LIST_STYLES, type ListStyle } from '@skans/shared';
import Underline from '@tiptap/extension-underline';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import TextAlign from '@tiptap/extension-text-align';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { AlignCenter, AlignLeft, AlignRight, Bold, HelpCircle, Italic, List, ListOrdered, Subscript as SubIcon, Superscript as SupIcon, Table as TableIcon, Underline as UnderlineIcon } from 'lucide-react';

interface RichEditorProps {
  value: string;
  onChange(value: string): void;
  /** Smaller editor without table tools, for MCQ options. */
  compact?: boolean;
  placeholder?: string;
  label?: string;
}

function ToolButton({ label, onClick, active = false, disabled = false, children }: { label: string; onClick(): void; active?: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-md px-2 text-xs font-semibold ${active ? 'bg-navy text-white' : 'text-slate-600 hover:bg-slate-200'} disabled:cursor-not-allowed disabled:opacity-35`}
    >
      {children}
    </button>
  );
}

/** Numbered lists remember their numbering style: (i), (I), (a), (A) or (1). */
const StyledOrderedList = OrderedList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      listStyle: {
        default: null,
        parseHTML: (el) => {
          const v = el.getAttribute('data-list-style');
          return (LIST_STYLES as readonly string[]).includes(v ?? '') ? v : null;
        },
        renderHTML: (attrs) => (attrs.listStyle ? { 'data-list-style': attrs.listStyle } : {}),
      },
    };
  },
});

/** Keeps an empty line after a table at the end, so you can always click below it and type. */
const TrailingParagraph = Extension.create({
  name: 'trailingParagraph',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (_transactions, _old, state) => {
          const last = state.doc.lastChild;
          if (!last || last.type.name !== 'table') return null;
          return state.tr.insert(state.doc.content.size, state.schema.nodes.paragraph.create());
        },
      }),
    ];
  },
});

/** Empty lines left at the very end are not saved. */
const trimTrailing = (html: string) => html.replace(/(<p><\/p>)+$/, '');

const Divider = () => <span className="mx-1 hidden self-stretch border-l border-slate-200 sm:block" />;

function TableTools({ editor }: { editor: Editor }) {
  const inTable = editor.isActive('table');
  const run = (fn: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => fn(editor.chain().focus()).run();
  return (
    <>
      <ToolButton label="Insert a 3 × 3 table with a header row" onClick={() => run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))} disabled={inTable}>
        <TableIcon size={15} />
        <span className="ml-1">Table</span>
      </ToolButton>
      {inTable && (
        <>
          <ToolButton label="Add row below" onClick={() => run((c) => c.addRowAfter())}>+ Row</ToolButton>
          <ToolButton label="Delete current row" onClick={() => run((c) => c.deleteRow())}>− Row</ToolButton>
          <ToolButton label="Add column to the right" onClick={() => run((c) => c.addColumnAfter())}>+ Col</ToolButton>
          <ToolButton label="Delete current column" onClick={() => run((c) => c.deleteColumn())}>− Col</ToolButton>
          <ToolButton label="Merge the selected adjacent cells" onClick={() => run((c) => c.mergeCells())} disabled={!editor.can().mergeCells()}>Merge</ToolButton>
          <ToolButton label="Split the merged cell" onClick={() => run((c) => c.splitCell())} disabled={!editor.can().splitCell()}>Split</ToolButton>
          <ToolButton label="Turn the first row into a header row (or back)" onClick={() => run((c) => c.toggleHeaderRow())} active={editor.isActive('tableHeader')}>Header row</ToolButton>
          <ToolButton label="Start a new line of text below this table" onClick={() => run((c) => c.command(({ tr, state }) => {
            const { $from } = state.selection;
            for (let depth = $from.depth; depth > 0; depth -= 1) {
              if ($from.node(depth).type.name !== 'table') continue;
              const pos = $from.after(depth);
              tr.insert(pos, state.schema.nodes.paragraph.create());
              tr.setSelection(TextSelection.create(tr.doc, pos + 1));
              return true;
            }
            return false;
          }))}>↵ Text below</ToolButton>
          <ToolButton label="Delete the whole table" onClick={() => run((c) => c.deleteTable())}>Delete table</ToolButton>
        </>
      )}
    </>
  );
}

export function RichEditor({ value, onChange, compact = false, placeholder, label }: RichEditorProps) {
  const [help, setHelp] = useState(false);
  // The editor is created once; always call the latest onChange so parents never see stale state.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, code: false, orderedList: false, blockquote: compact ? false : undefined }),
      StyledOrderedList,
      Underline,
      Superscript,
      Subscript,
      TextAlign.configure({ types: ['paragraph'] }),
      Table.configure({ resizable: !compact }),
      TableRow,
      TableHeader,
      TableCell,
      TrailingParagraph,
    ],
    content: value,
    editorProps: { attributes: { 'aria-label': label ?? placeholder ?? 'Rich text', ...(placeholder ? { 'data-placeholder': placeholder } : {}) } },
    onUpdate: ({ editor: instance }) => onChangeRef.current(instance.isEmpty ? '' : trimTrailing(instance.getHTML())),
  });
  if (!editor) return <div className={`${compact ? 'h-12' : 'h-48'} animate-pulse rounded-xl bg-slate-100`} />;
  const run = (fn: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => fn(editor.chain().focus()).run();
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white font-normal text-ink">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-100 bg-slate-50 p-1.5">
        <ToolButton label="Bold" onClick={() => run((c) => c.toggleBold())} active={editor.isActive('bold')}><Bold size={15} /></ToolButton>
        <ToolButton label="Italic" onClick={() => run((c) => c.toggleItalic())} active={editor.isActive('italic')}><Italic size={15} /></ToolButton>
        <ToolButton label="Underline" onClick={() => run((c) => c.toggleUnderline())} active={editor.isActive('underline')}><UnderlineIcon size={15} /></ToolButton>
        <ToolButton label="Superscript" onClick={() => run((c) => c.toggleSuperscript())} active={editor.isActive('superscript')}><SupIcon size={15} /></ToolButton>
        <ToolButton label="Subscript" onClick={() => run((c) => c.toggleSubscript())} active={editor.isActive('subscript')}><SubIcon size={15} /></ToolButton>
        {!compact && (
          <>
            <Divider />
            <ToolButton label="Bulleted list" onClick={() => run((c) => c.toggleBulletList())} active={editor.isActive('bulletList')}><List size={15} /></ToolButton>
            <ToolButton label="Numbered list: (i), (I), (a), (A) or (1)" onClick={() => run((c) => c.toggleOrderedList())} active={editor.isActive('orderedList')}><ListOrdered size={15} /></ToolButton>
            {editor.isActive('orderedList') && LIST_STYLES.map((s: ListStyle) => {
              const current = (editor.getAttributes('orderedList').listStyle as ListStyle | null) ?? 'lower-roman';
              return <ToolButton key={s} label={`Number the list ${LIST_STYLE_LABELS[s]}`} onClick={() => run((c) => c.updateAttributes('orderedList', { listStyle: s }))} active={current === s}>{LIST_STYLE_LABELS[s]}</ToolButton>;
            })}
            <Divider />
            <ToolButton label="Align left" onClick={() => run((c) => c.setTextAlign('left'))} active={editor.isActive({ textAlign: 'left' })}><AlignLeft size={15} /></ToolButton>
            <ToolButton label="Centre" onClick={() => run((c) => c.setTextAlign('center'))} active={editor.isActive({ textAlign: 'center' })}><AlignCenter size={15} /></ToolButton>
            <ToolButton label="Align right (use for figures in tables)" onClick={() => run((c) => c.setTextAlign('right'))} active={editor.isActive({ textAlign: 'right' })}><AlignRight size={15} /></ToolButton>
            <Divider />
            <TableTools editor={editor} />
            <span className="ml-auto" />
            <ToolButton label="How tables work" onClick={() => setHelp(!help)} active={help}><HelpCircle size={15} /></ToolButton>
          </>
        )}
      </div>
      {!compact && help && (
        <ul className="list-disc space-y-1 border-b border-slate-100 bg-blue-50/60 py-2 pl-8 pr-3 text-xs leading-5 text-blue-950">
          <li><strong>Merge</strong>: first select two or more <em>adjacent</em> cells by dragging across them (or Shift + click), then press Merge. <strong>Split</strong> undoes a merge.</li>
          <li><strong>Header row</strong> applies to the table&apos;s first row. Header rows print in bold and <strong>repeat at the top of each printed page</strong> when a long table continues onto the next page.</li>
          <li>You can paste tables from Word or Excel. Formatting is cleaned automatically; check the result and set the header row if needed.</li>
          <li><strong>Column width</strong>: drag the right edge of a column to make it narrower or wider; the table is only as wide as its columns, like the ICAP papers.</li>
          <li><strong>Figures</strong>: click in a cell and use <strong>Align right</strong> so amounts line up.</li>
          <li><strong>Text below</strong> starts a new line after the table (or simply click just below the table).</li>
          <li>Short tables are never split across printed pages.</li>
        </ul>
      )}
      <EditorContent editor={editor} className={`rich-editor ${compact ? 'compact px-3 py-2' : 'min-h-48 p-4'} text-sm leading-6 outline-none`} />
    </div>
  );
}
