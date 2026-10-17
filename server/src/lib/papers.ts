import type { Prisma } from '@prisma/client';
import {
  effectiveItemMarks,
  fillTokens,
  paperHeaderSchema,
  safeFileName,
  templateConfigSchema,
  type PaperDTO,
  type PaperHeader,
  type PaperStatus,
  type PaperSummaryDTO,
  type QuestionType,
  type TemplateConfig,
} from '@skans/shared';
import { prisma } from '../db';
import type { RenderInput, RenderItem } from '../render/paperHtml';
import { badRequest } from './http';
import { parseJson, questionInclude, toQuestionDTO } from './questions';

export const paperInclude = {
  subject: { select: { code: true, name: true } },
  template: { select: { name: true, config: true } },
  createdBy: { select: { fullName: true } },
  items: { include: { question: { include: questionInclude } }, orderBy: { position: 'asc' } },
} satisfies Prisma.PaperInclude;

export type PaperRow = Prisma.PaperGetPayload<{ include: typeof paperInclude }>;

export function parseHeader(text: string): PaperHeader {
  const r = paperHeaderSchema.safeParse(parseJson(text, {}));
  return r.success ? r.data : paperHeaderSchema.parse({});
}

export function parseTemplateConfig(text: string): TemplateConfig {
  const r = templateConfigSchema.safeParse(parseJson(text, {}));
  if (!r.success) throw badRequest('The paper template configuration is invalid. Ask the administrator to fix it.');
  return r.data;
}

function itemMarks(it: PaperRow['items'][number]) {
  return effectiveItemMarks(
    { type: it.question.type as QuestionType, content: parseJson(it.question.content, {}), marks: it.question.marks },
    it.marksOverride,
  );
}

export function toPaperSummary(p: PaperRow): PaperSummaryDTO {
  const header = parseHeader(p.header);
  return {
    id: p.id,
    title: p.title,
    subjectId: p.subjectId,
    subjectCode: p.subject.code,
    templateId: p.templateId,
    templateName: p.template.name,
    status: p.status as PaperStatus,
    totalMarks: Math.round(p.items.reduce((s, it) => s + itemMarks(it), 0) * 100) / 100,
    maxMarks: header.maxMarks,
    questionCount: p.items.length,
    currentVersion: p.currentVersion,
    createdBy: p.createdBy.fullName,
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function toPaperDTO(p: PaperRow): PaperDTO {
  return {
    ...toPaperSummary(p),
    header: parseHeader(p.header),
    items: p.items.map((it) => ({
      id: it.id,
      questionId: it.questionId,
      section: it.section,
      position: it.position,
      marksOverride: it.marksOverride,
      newPage: it.newPage,
      question: toQuestionDTO(it.question),
    })),
  };
}

/** Full, self-contained snapshot stored with every saved version. */
export interface PaperSnapshot {
  title: string;
  subjectId: number;
  subject: { code: string; name: string };
  templateId: number;
  templateConfig: TemplateConfig;
  status: PaperStatus;
  header: PaperHeader;
  items: {
    questionId: number;
    section: string;
    marksOverride: number | null;
    newPage: boolean;
    question: { id: number; type: QuestionType; marks: number; body: string; content: Record<string, unknown>; answer: string; advice: string };
  }[];
}

export function buildSnapshot(p: PaperRow, templateConfig: TemplateConfig): PaperSnapshot {
  return {
    title: p.title,
    subjectId: p.subjectId,
    subject: { code: p.subject.code, name: p.subject.name },
    templateId: p.templateId,
    templateConfig,
    status: p.status as PaperStatus,
    header: parseHeader(p.header),
    items: p.items.map((it) => ({
      questionId: it.questionId,
      section: it.section,
      marksOverride: it.marksOverride,
      newPage: it.newPage,
      question: {
        id: it.question.id,
        type: it.question.type as QuestionType,
        marks: it.question.marks,
        body: it.question.body,
        content: parseJson(it.question.content, {}),
        answer: it.question.answer,
        advice: it.question.advice,
      },
    })),
  };
}

export function snapshotToRenderInput(s: PaperSnapshot, mode: 'paper' | 'key', watermark: string | null): RenderInput {
  return {
    mode,
    config: s.templateConfig,
    subject: s.subject,
    header: s.header,
    title: s.title,
    watermark,
    items: s.items.map(
      (it): RenderItem => ({
        question: it.question,
        section: it.section,
        newPage: it.newPage,
        marks: effectiveItemMarks(it.question, it.marksOverride),
      }),
    ),
  };
}

export function downloadFileName(cfg: TemplateConfig, kind: 'paper' | 'answerKey', s: { subject: { code: string; name: string }; header: PaperHeader }) {
  const pattern = kind === 'paper' ? cfg.filenames.paper : cfg.filenames.answerKey;
  const name = fillTokens(pattern, {
    code: s.subject.code,
    subject: s.subject.name,
    session: s.header.session || 'Paper',
    batch: s.header.batchNo || 'X',
    test: s.header.testNo || 'X',
    date: s.header.examDate,
  });
  return `${safeFileName(name)}.pdf`;
}
