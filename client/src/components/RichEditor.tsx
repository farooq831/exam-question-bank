import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';

interface RichEditorProps {
  value: string;
  onChange(value: string): void;
}

export function RichEditor({ value, onChange }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Superscript,
      Subscript,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value,
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
  });
  if (!editor) return <div className="h-48 animate-pulse rounded-xl bg-slate-100" />;
  const button = (label: string, action: () => void, active = false) => <button type="button" onClick={action} className={`rounded px-2 py-1 text-xs font-semibold ${active ? 'bg-navy text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>;
  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="flex flex-wrap gap-1 border-b border-slate-100 bg-slate-50 p-2">
      {button('B', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
      {button('I', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
      {button('U', () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'))}
      {button('x²', () => editor.chain().focus().toggleSuperscript().run(), editor.isActive('superscript'))}
      {button('x₂', () => editor.chain().focus().toggleSubscript().run(), editor.isActive('subscript'))}
      {button('• List', () => editor.chain().focus().toggleBulletList().run())}
      {button('1. List', () => editor.chain().focus().toggleOrderedList().run())}
      <span className="mx-1 border-l border-slate-200" />
      {button('Table', () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
      {button('+ row', () => editor.chain().focus().addRowAfter().run())}
      {button('+ col', () => editor.chain().focus().addColumnAfter().run())}
      {button('− row', () => editor.chain().focus().deleteRow().run())}
      {button('− col', () => editor.chain().focus().deleteColumn().run())}
      {button('Merge', () => editor.chain().focus().mergeCells().run())}
      {button('Header', () => editor.chain().focus().toggleHeaderRow().run())}
    </div>
    <EditorContent editor={editor} className="rich-editor min-h-48 p-4 text-sm leading-6 outline-none" />
  </div>;
}
