import {
  computeQuestionMarks,
  type Difficulty,
  type LabelStyle,
  type McqLayout,
  type QuestionDTO,
  type QuestionStatus,
  type QuestionType,
  type SessionUser,
} from '@skans/shared';

/** Editable form state for every question type. Content is hydrated from saved questions so nothing is lost on edit. */
/** `uid` only keeps React editors stable while options are added or removed; it is not saved. */
export interface Option { uid: string; key: string; html: string; correct: boolean }
export interface SubPart { id: string; html: string; marks: number; answer: string }
export interface Part extends SubPart { parts: SubPart[] }
export interface GroupItem { id: string; stem: string; options: Option[]; layout: McqLayout; marks: number }

export interface QuestionDraft {
  id?: number;
  status?: QuestionStatus;
  reviewComment?: string;
  createdById?: number;
  subjectId: number;
  type: QuestionType;
  topic: string;
  marks: number;
  difficulty: Difficulty;
  source: string;
  body: string;
  answer: string;
  advice: string;
  comments: string;
  options: Option[];
  mcqLayout: McqLayout;
  groupItems: GroupItem[];
  tfCorrect: boolean;
  parts: Part[];
  partLabelStyle: LabelStyle | null;
}

/** Works without crypto.randomUUID, which browsers only offer on HTTPS. */
export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const letter = (i: number) => String.fromCharCode(97 + i);

export const newOption = (i: number): Option => ({ uid: newId(), key: letter(i), html: '', correct: false });
export const defaultOptions = (): Option[] => [0, 1, 2, 3].map((i) => ({ ...newOption(i), correct: i === 0 }));
export const newSubPart = (): SubPart => ({ id: newId(), html: '', marks: 1, answer: '' });
export const newPart = (): Part => ({ ...newSubPart(), marks: 2, parts: [] });
export const newGroupItem = (): GroupItem => ({ id: newId(), stem: '', options: defaultOptions(), layout: 'auto', marks: 1 });

export function emptyDraft(subjectId: number): QuestionDraft {
  return {
    subjectId,
    type: 'SHORT',
    topic: '',
    marks: 5,
    difficulty: 'MEDIUM',
    source: '',
    body: '',
    answer: '',
    advice: '',
    comments: '',
    options: defaultOptions(),
    mcqLayout: 'auto',
    groupItems: [newGroupItem()],
    tfCorrect: true,
    parts: [newPart()],
    partLabelStyle: null,
  };
}

const asOptions = (v: unknown): Option[] =>
  Array.isArray(v) && v.length ? v.map((o, i) => ({ uid: newId(), key: letter(i), html: String(o?.html ?? ''), correct: Boolean(o?.correct) })) : defaultOptions();

const asSubParts = (v: unknown): SubPart[] =>
  Array.isArray(v) ? v.map((s) => ({ id: String(s?.id ?? newId()), html: String(s?.html ?? ''), marks: Number(s?.marks ?? 0), answer: String(s?.answer ?? '') })) : [];

export function draftFromQuestion(q: QuestionDTO): QuestionDraft {
  const c = q.content as Record<string, unknown>;
  const base = emptyDraft(q.subjectId);
  return {
    ...base,
    id: q.id,
    status: q.status,
    reviewComment: q.reviewComment,
    createdById: q.createdById,
    type: q.type,
    topic: q.topic,
    marks: q.marks,
    difficulty: q.difficulty,
    source: q.source,
    body: q.body,
    answer: q.answer,
    advice: q.advice,
    comments: q.comments,
    options: q.type === 'MCQ' ? asOptions(c.options) : base.options,
    mcqLayout: (q.type === 'MCQ' ? (c.layout as McqLayout) : undefined) ?? 'auto',
    groupItems:
      q.type === 'MCQ_GROUP' && Array.isArray(c.items) && c.items.length
        ? (c.items as Record<string, unknown>[]).map((it) => ({
            id: String(it.id ?? newId()),
            stem: String(it.stem ?? ''),
            options: asOptions(it.options),
            layout: (it.layout as McqLayout) ?? 'auto',
            marks: Number(it.marks ?? 1),
          }))
        : base.groupItems,
    tfCorrect: q.type === 'TRUE_FALSE' ? Boolean(c.correct) : true,
    parts:
      (q.type === 'LONG' || q.type === 'CASE_STUDY') && Array.isArray(c.parts)
        ? (c.parts as Record<string, unknown>[]).map((p) => ({ ...asSubParts([p])[0], parts: asSubParts(p.parts) }))
        : base.parts,
    partLabelStyle: (c.partLabelStyle as LabelStyle | null | undefined) ?? null,
  };
}

export function draftContent(d: QuestionDraft): Record<string, unknown> {
  const opts = (o: Option[]) => o.map((x, i) => ({ key: letter(i), html: x.html, correct: x.correct }));
  switch (d.type) {
    case 'MCQ':
      return { options: opts(d.options), layout: d.mcqLayout };
    case 'MCQ_GROUP':
      return { items: d.groupItems.map((it) => ({ id: it.id, stem: it.stem, options: opts(it.options), layout: it.layout, marks: it.marks })) };
    case 'TRUE_FALSE':
      return { correct: d.tfCorrect };
    case 'LONG':
    case 'CASE_STUDY':
      return { parts: d.parts, partLabelStyle: d.partLabelStyle };
    default:
      return {};
  }
}

/** Marks shown to the user; structured questions derive them from parts/items exactly like the server. */
export const draftMarks = (d: QuestionDraft) => computeQuestionMarks(d.type, draftContent(d), Number(d.marks) || 0);
export const marksAreStructured = (d: QuestionDraft) =>
  (d.type === 'MCQ_GROUP' && d.groupItems.length > 0) || ((d.type === 'LONG' || d.type === 'CASE_STUDY') && d.parts.length > 0);

export function draftPayload(d: QuestionDraft) {
  return {
    subjectId: d.subjectId,
    type: d.type,
    topic: d.topic,
    marks: draftMarks(d),
    difficulty: d.difficulty,
    source: d.source,
    body: d.body,
    answer: d.answer,
    advice: d.advice,
    comments: d.comments,
    content: draftContent(d),
  };
}

const hasText = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0 || /<table/.test(html);

/** Friendly client-side checks; the server repeats all validation. */
export function validateDraft(d: QuestionDraft): string[] {
  const errors: string[] = [];
  if (!hasText(d.body)) errors.push('Enter the question text.');
  const checkOptions = (o: Option[], where: string) => {
    if (o.length < 2 || o.length > 6) errors.push(`${where}: use between 2 and 6 options.`);
    if (o.filter((x) => x.correct).length !== 1) errors.push(`${where}: mark exactly one correct option.`);
    if (o.some((x) => !hasText(x.html))) errors.push(`${where}: every option needs text.`);
  };
  if (d.type === 'MCQ') checkOptions(d.options, 'Options');
  if (d.type === 'MCQ_GROUP') {
    if (!d.groupItems.length) errors.push('Add at least one MCQ to the group.');
    d.groupItems.forEach((it, i) => {
      if (!hasText(it.stem)) errors.push(`MCQ ${i + 1}: enter the question text.`);
      checkOptions(it.options, `MCQ ${i + 1}`);
    });
  }
  if ((d.type === 'LONG' || d.type === 'CASE_STUDY') && d.parts.some((p) => !hasText(p.html) && !p.parts.length)) {
    errors.push('Every part needs text (or remove empty parts).');
  }
  if (draftMarks(d) <= 0) errors.push('Marks must be greater than zero.');
  return errors;
}

/** Mirrors the server rules so only actions that will succeed are shown. */
export function questionActions(user: SessionUser, q: Pick<QuestionDTO, 'status' | 'createdById' | 'subjectId' | 'deletedAt'>) {
  const own = q.createdById === user.id;
  const inScope = user.role === 'ADMIN' || user.subjectIds.includes(q.subjectId);
  const live = !q.deletedAt;
  const canDelete = user.role === 'ADMIN' || (inScope && (user.role === 'HOA' || (own && q.status !== 'APPROVED')));
  return {
    edit: live && user.subjectIds.includes(q.subjectId) && (user.role === 'HOA' || (user.role === 'TEACHER' && own && (q.status === 'DRAFT' || q.status === 'REJECTED'))),
    submit: live && own && (q.status === 'DRAFT' || q.status === 'REJECTED'),
    review: live && inScope && user.role !== 'TEACHER' && (q.status === 'SUBMITTED' || (own && (q.status === 'DRAFT' || q.status === 'REJECTED'))),
    remove: live && canDelete,
    restore: !live && canDelete,
    duplicate: live && inScope,
  };
}
