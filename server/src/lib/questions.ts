import type { Prisma } from '@prisma/client';
import {
  computeQuestionMarks,
  type Difficulty,
  type McqGroupContent,
  type PartsContent,
  type QuestionDTO,
  type QuestionInput,
  type QuestionStatus,
  type QuestionType,
} from '@skans/shared';
import { badRequest } from './http';
import { htmlToText, sanitizeRich } from './sanitize';

/** Sanitizes every rich-text field, including those nested inside type-specific content. */
export function sanitizeQuestionInput(input: QuestionInput) {
  let content: Record<string, unknown>;
  switch (input.type) {
    case 'MCQ':
      content = {
        layout: input.content.layout,
        options: input.content.options.map((o, i) => ({
          key: String.fromCharCode(97 + i),
          html: sanitizeRich(o.html),
          correct: o.correct,
        })),
      };
      break;
    case 'MCQ_GROUP':
      content = {
        items: input.content.items.map((it) => ({
          id: it.id,
          stem: sanitizeRich(it.stem),
          layout: it.layout,
          marks: it.marks,
          options: it.options.map((o, i) => ({
            key: String.fromCharCode(97 + i),
            html: sanitizeRich(o.html),
            correct: o.correct,
          })),
        })),
      } satisfies McqGroupContent;
      break;
    case 'TRUE_FALSE':
      content = { correct: input.content.correct };
      break;
    case 'SHORT':
      content = {};
      break;
    case 'LONG':
    case 'CASE_STUDY':
      content = {
        partLabelStyle: input.content.partLabelStyle,
        parts: input.content.parts.map((p) => ({
          id: p.id,
          html: sanitizeRich(p.html),
          marks: p.marks,
          answer: sanitizeRich(p.answer),
          parts: p.parts.map((s) => ({
            id: s.id,
            html: sanitizeRich(s.html),
            marks: s.marks,
            answer: sanitizeRich(s.answer),
          })),
        })),
      } satisfies PartsContent;
      break;
  }
  const body = sanitizeRich(input.body);
  const answer = sanitizeRich(input.answer);
  const advice = sanitizeRich(input.advice);
  const marks = computeQuestionMarks(input.type, content, input.marks);
  return {
    subjectId: input.subjectId,
    topic: input.topic,
    type: input.type,
    marks,
    difficulty: input.difficulty,
    source: input.source,
    body,
    content: JSON.stringify(content),
    answer,
    advice,
    comments: input.comments,
    searchText: buildSearchText(input.topic, input.source, body, content, answer),
  };
}

export function buildSearchText(
  topic: string,
  source: string,
  body: string,
  content: Record<string, unknown>,
  answer: string,
): string {
  const chunks = [topic, source, htmlToText(body), htmlToText(answer)];
  const walk = (v: unknown) => {
    if (typeof v === 'string') chunks.push(htmlToText(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(content);
  return chunks.join(' ').toLowerCase().slice(0, 20_000);
}

export function parseJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export const questionInclude = {
  subject: { select: { code: true, name: true } },
  createdBy: { select: { fullName: true } },
  updatedBy: { select: { fullName: true } },
  reviewedBy: { select: { fullName: true } },
} satisfies Prisma.QuestionInclude;

export type QuestionRow = Prisma.QuestionGetPayload<{ include: typeof questionInclude }>;

export function toQuestionDTO(q: QuestionRow, extra?: { usedInPapers?: number }): QuestionDTO {
  return {
    id: q.id,
    subjectId: q.subjectId,
    subjectCode: q.subject.code,
    subjectName: q.subject.name,
    topic: q.topic,
    type: q.type as QuestionType,
    marks: q.marks,
    difficulty: q.difficulty as Difficulty,
    source: q.source,
    body: q.body,
    content: parseJson(q.content, {}),
    answer: q.answer,
    advice: q.advice,
    comments: q.comments,
    status: q.status as QuestionStatus,
    reviewComment: q.reviewComment,
    reviewedBy: q.reviewedBy?.fullName ?? null,
    reviewedAt: q.reviewedAt?.toISOString() ?? null,
    createdById: q.createdById,
    createdBy: q.createdBy.fullName,
    updatedBy: q.updatedBy?.fullName ?? null,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
    deletedAt: q.deletedAt?.toISOString() ?? null,
    ...extra,
  };
}

/**
 * The same checks the editor makes, enforced on the server so direct API calls cannot store an
 * empty question (e.g. "<p></p>" or only spaces) or one worth zero marks.
 */
export function assertQuestionComplete(data: { body: string; marks: number }) {
  if (!htmlToText(data.body) && !/<table/i.test(data.body)) throw badRequest('Question text is required.');
  if (!(data.marks > 0)) throw badRequest('Marks must be greater than zero.');
}
