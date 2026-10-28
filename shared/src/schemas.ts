import { z } from 'zod';
import {
  DIFFICULTIES,
  LABEL_STYLES,
  MCQ_LAYOUTS,
  PAPER_STATUSES,
  QUESTION_STATUSES,
  QUESTION_TYPES,
  ROLES,
} from './constants';

/** Plain-English messages for zod's built-in checks (shown to users next to the field name). */
z.config({
  customError: (iss) => {
    const n = (v: unknown) => String(v);
    switch (iss.code) {
      case 'too_small':
        if (iss.origin === 'string') return Number(iss.minimum) <= 1 ? 'This field is required' : `Use at least ${n(iss.minimum)} characters`;
        if (iss.origin === 'array') return `Add at least ${n(iss.minimum)}`;
        return `Must be at least ${n(iss.minimum)}`;
      case 'too_big':
        if (iss.origin === 'string') return `Use at most ${n(iss.maximum)} characters`;
        if (iss.origin === 'array') return `No more than ${n(iss.maximum)} allowed`;
        return `Must be at most ${n(iss.maximum)}`;
      case 'invalid_type':
        return iss.input === undefined ? 'This field is required' : iss.expected === 'number' ? 'Enter a number' : 'Invalid value';
      case 'invalid_value':
        return 'Choose one of the options';
      case 'not_multiple_of':
        return `Use steps of ${n(iss.divisor)}`;
      default:
        return undefined;
    }
  },
});

const html = (max = 200_000) => z.string().max(max);
const id = z.coerce.number().int().positive();
const marksValue = z.number().min(0).max(200).multipleOf(0.5);

// ---------- Auth & users ----------

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(60),
  password: z.string().min(1, 'Password is required').max(200),
});

export const passwordPolicy = z
  .string()
  .min(10, 'At least 10 characters')
  .max(200)
  .regex(/[A-Za-z]/, 'Must contain a letter')
  .regex(/[0-9]/, 'Must contain a digit');

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: passwordPolicy,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const username = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9_.]+$/, 'Lowercase letters, digits, dot and underscore only');

export const userCreateSchema = z.object({
  username,
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200).optional().or(z.literal('')),
  role: z.enum(ROLES),
  password: passwordPolicy,
  subjectIds: z.array(id).max(50).default([]),
  isActive: z.boolean().default(true),
});

export const userUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200).optional().or(z.literal('')),
  role: z.enum(ROLES),
  subjectIds: z.array(id).max(50),
  isActive: z.boolean(),
});

export const resetPasswordSchema = z.object({ newPassword: passwordPolicy });

// ---------- Subjects ----------

export const subjectInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(12)
    .regex(/^[A-Z0-9]+$/, 'Capital letters and digits only'),
  name: z.string().trim().min(2).max(120),
  level: z.string().trim().max(20).default(''),
  templateId: id.nullable(),
  isActive: z.boolean().default(true),
});

// ---------- Questions ----------

export const optionSchema = z.object({
  key: z.string().max(4),
  html: html(20_000),
  correct: z.boolean(),
});

const optionsSchema = z
  .array(optionSchema)
  .min(2, 'At least two options')
  .max(6, 'At most six options')
  .refine((o) => o.filter((x) => x.correct).length === 1, 'Mark exactly one correct option');

export const mcqContentSchema = z.object({
  options: optionsSchema,
  layout: z.enum(MCQ_LAYOUTS).default('auto'),
});

export const mcqGroupItemSchema = z.object({
  id: z.string().max(40),
  stem: html(50_000),
  options: optionsSchema,
  layout: z.enum(MCQ_LAYOUTS).default('auto'),
  marks: marksValue.min(0.5),
});

export const mcqGroupContentSchema = z.object({
  items: z.array(mcqGroupItemSchema).min(1, 'Add at least one MCQ').max(40),
});

export const trueFalseContentSchema = z.object({ correct: z.boolean() });

export const subPartSchema = z.object({
  id: z.string().max(40),
  html: html(100_000),
  marks: marksValue,
  answer: html(100_000).default(''),
});

export const partSchema = z.object({
  id: z.string().max(40),
  html: html(100_000),
  marks: marksValue,
  answer: html(100_000).default(''),
  parts: z.array(subPartSchema).max(12).default([]),
});

export const partsContentSchema = z.object({
  parts: z.array(partSchema).max(12).default([]),
  partLabelStyle: z.enum(LABEL_STYLES).nullable().default(null),
});

export const emptyContentSchema = z.object({}).passthrough();

export type McqOption = z.infer<typeof optionSchema>;
export type McqContent = z.infer<typeof mcqContentSchema>;
export type McqGroupItem = z.infer<typeof mcqGroupItemSchema>;
export type McqGroupContent = z.infer<typeof mcqGroupContentSchema>;
export type TrueFalseContent = z.infer<typeof trueFalseContentSchema>;
export type QuestionPart = z.infer<typeof partSchema>;
export type QuestionSubPart = z.infer<typeof subPartSchema>;
export type PartsContent = z.infer<typeof partsContentSchema>;

const questionBase = z.object({
  subjectId: id,
  topic: z.string().trim().max(120).default(''),
  marks: marksValue,
  difficulty: z.enum(DIFFICULTIES).default('MEDIUM'),
  source: z.string().trim().max(120).default(''),
  body: html(),
  answer: html().default(''),
  advice: html(50_000).default(''),
  comments: z.string().max(5_000).default(''),
});

/** Discriminated by question type so content is always shaped correctly. */
export const questionInputSchema = z.discriminatedUnion('type', [
  questionBase.extend({ type: z.literal('MCQ'), content: mcqContentSchema }),
  questionBase.extend({ type: z.literal('MCQ_GROUP'), content: mcqGroupContentSchema }),
  questionBase.extend({ type: z.literal('TRUE_FALSE'), content: trueFalseContentSchema }),
  questionBase.extend({ type: z.literal('SHORT'), content: emptyContentSchema.default({}) }),
  questionBase.extend({ type: z.literal('LONG'), content: partsContentSchema }),
  questionBase.extend({ type: z.literal('CASE_STUDY'), content: partsContentSchema }),
]);
export type QuestionInput = z.infer<typeof questionInputSchema>;

export const reviewSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  comment: z.string().trim().max(2_000).default(''),
}).refine((v) => v.decision === 'APPROVE' || v.comment.length > 0, {
  message: 'A comment is required when rejecting',
  path: ['comment'],
});

export const questionQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  subjectId: id.optional(),
  type: z.enum(QUESTION_TYPES).optional(),
  status: z.enum(QUESTION_STATUSES).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  marksMin: z.coerce.number().min(0).max(200).optional(),
  marksMax: z.coerce.number().min(0).max(200).optional(),
  source: z.string().trim().max(120).optional(),
  topic: z.string().trim().max(120).optional(),
  mine: z.enum(['1', '0']).optional(),
  deleted: z.enum(['1', '0']).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['updated', 'created', 'marks', 'subject']).default('updated'),
});
export type QuestionQuery = z.infer<typeof questionQuerySchema>;

// ---------- Papers ----------

export const paperHeaderSchema = z.object({
  session: z.string().trim().max(60).default(''),
  examDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .or(z.literal(''))
    .default(''),
  durationMinutes: z.number().int().min(0).max(600).default(180),
  readingMinutes: z.number().int().min(0).max(120).default(15),
  maxMarks: z.number().min(0).max(500).default(100),
  batchNo: z.string().trim().max(40).default(''),
  teacherName: z.string().trim().max(120).default(''),
  /** People responsible for the paper; printed on the answer key only, never on the question paper. */
  researchOfficers: z.string().trim().max(200).default(''),
  adminName: z.string().trim().max(120).default(''),
  testNo: z.string().trim().max(40).default(''),
  titleOverride: z.string().trim().max(200).default(''),
  instructionsOverride: z.array(z.string().trim().max(300)).max(20).nullable().default(null),
});
export type PaperHeader = z.infer<typeof paperHeaderSchema>;

export const paperItemInputSchema = z.object({
  questionId: id,
  section: z.string().trim().max(60).default(''),
  marksOverride: marksValue.nullable().default(null),
  newPage: z.boolean().default(false),
});
export type PaperItemInput = z.infer<typeof paperItemInputSchema>;

export const paperInputSchema = z.object({
  title: z.string().trim().min(2).max(200),
  subjectId: id,
  templateId: id,
  status: z.enum(PAPER_STATUSES).default('DRAFT'),
  header: paperHeaderSchema,
  items: z.array(paperItemInputSchema).max(200),
  versionNote: z.string().trim().max(300).default(''),
  /** Must be true to mark a paper FINAL when its total differs from the maximum marks. */
  acknowledgeMarksMismatch: z.boolean().default(false),
});
export type PaperInput = z.infer<typeof paperInputSchema>;

/** Render a paper that may not be saved yet (live preview). */
export const paperPreviewSchema = paperInputSchema.omit({ status: true, versionNote: true, acknowledgeMarksMismatch: true }).extend({
  mode: z.enum(['paper', 'key']).default('paper'),
  title: z.string().trim().max(200).default('Untitled paper'),
});

export const autoGenerateRuleSchema = z.object({
  type: z.enum(QUESTION_TYPES).optional(),
  count: z.number().int().min(1).max(50),
  marks: marksValue.optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  section: z.string().trim().max(60).default(''),
});

export const autoGenerateSchema = z.object({
  subjectId: id,
  topics: z.array(z.string().trim().max(120)).max(100).default([]),
  avoidLastNPapers: z.number().int().min(0).max(50).default(0),
  excludeQuestionIds: z.array(id).max(500).default([]),
  rules: z.array(autoGenerateRuleSchema).min(1).max(20),
});
export type AutoGenerateInput = z.infer<typeof autoGenerateSchema>;

export const downloadQuerySchema = z.object({
  watermark: z.enum(['1', '0']).default('0'),
});

// ---------- Audit ----------

export const auditQuerySchema = z.object({
  action: z.string().trim().max(60).optional(),
  username: z.string().trim().max(60).optional(),
  entityType: z.string().trim().max(40).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
