import type { QuestionType } from './constants';

const round = (n: number) => Math.round(n * 100) / 100;

/** Marks of a part: the sum of its sub-parts when it has any, otherwise its own marks. */
export function partMarks(part: { marks: number; parts?: { marks: number }[] }): number {
  if (part.parts && part.parts.length > 0) return round(part.parts.reduce((s, p) => s + (p.marks || 0), 0));
  return part.marks || 0;
}

/**
 * The marks a question is worth, derived from its structure where possible so that the stored
 * total can never disagree with the parts the examinee sees.
 */
export function computeQuestionMarks(type: QuestionType, content: unknown, fallbackMarks: number): number {
  const c = (content ?? {}) as Record<string, unknown>;
  if (type === 'MCQ_GROUP' && Array.isArray(c.items) && c.items.length > 0) {
    return round((c.items as { marks: number }[]).reduce((s, i) => s + (i.marks || 0), 0));
  }
  if ((type === 'LONG' || type === 'CASE_STUDY') && Array.isArray(c.parts) && c.parts.length > 0) {
    return round((c.parts as { marks: number; parts?: { marks: number }[] }[]).reduce((s, p) => s + partMarks(p), 0));
  }
  return fallbackMarks;
}

/** True when marks come from the question's structure (group items or parts) and cannot be overridden. */
export function hasStructuredMarks(type: QuestionType, content: unknown): boolean {
  const c = (content ?? {}) as Record<string, unknown>;
  if (type === 'MCQ_GROUP') return Array.isArray(c.items) && c.items.length > 0;
  if (type === 'LONG' || type === 'CASE_STUDY') return Array.isArray(c.parts) && c.parts.length > 0;
  return false;
}

/** Marks a question contributes to a paper, honouring a per-paper override where allowed. */
export function effectiveItemMarks(
  q: { type: QuestionType; content: unknown; marks: number },
  marksOverride: number | null | undefined,
): number {
  if (marksOverride === null || marksOverride === undefined || hasStructuredMarks(q.type, q.content)) return q.marks;
  return marksOverride;
}

export type MarksStatus = 'match' | 'under' | 'over' | 'empty';

export interface MarksCheck {
  total: number;
  maxMarks: number;
  difference: number; // total - maxMarks
  status: MarksStatus;
  message: string;
}

/** Validates the running total of a paper against its maximum marks. */
export function checkPaperMarks(itemMarks: number[], maxMarks: number): MarksCheck {
  const total = round(itemMarks.reduce((s, m) => s + (Number.isFinite(m) ? m : 0), 0));
  const difference = round(total - maxMarks);
  if (itemMarks.length === 0) {
    return { total, maxMarks, difference, status: 'empty', message: 'No questions added yet.' };
  }
  if (difference === 0) {
    return { total, maxMarks, difference, status: 'match', message: `Total ${total} matches maximum marks.` };
  }
  if (difference < 0) {
    return {
      total,
      maxMarks,
      difference,
      status: 'under',
      message: `Total is ${total}: ${Math.abs(difference)} mark(s) short of the maximum ${maxMarks}.`,
    };
  }
  return {
    total,
    maxMarks,
    difference,
    status: 'over',
    message: `Total is ${total}: ${difference} mark(s) more than the maximum ${maxMarks}.`,
  };
}
