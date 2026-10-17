import { z } from 'zod';
import { DATE_FORMATS, FONT_KEYS, LABEL_STYLES } from './constants';

const shortText = (max = 200) => z.string().trim().max(max);

/**
 * Paper template configuration. Stored as JSON in PaperTemplate.config and validated on every
 * save, so formats are data rather than code. See README "Adding a new paper template".
 *
 * Text placeholders available in headings, running header and file names:
 *   {n} question number · {session} e.g. "Spring 2026" · {subject} subject name · {code} subject code
 *   {page} {pages} page numbers (running header only) · {batch} · {test} · {date}
 * Marks placeholders: {n} raw marks · {nn} zero padded to 2 digits.
 * Instruction placeholders: {count} number of questions · {countWord} e.g. "NINE" · **bold**.
 */
export const templateConfigSchema = z.object({
  layout: z.enum(['ICAP', 'SKANS']),
  fonts: z.object({
    body: z.enum(FONT_KEYS),
    heading: z.enum(FONT_KEYS),
    runningHeader: z.enum(FONT_KEYS),
    sizePt: z.number().min(8).max(14),
    lineHeight: z.number().min(1).max(2),
  }),
  page: z.object({
    marginTopMm: z.number().min(5).max(50),
    marginBottomMm: z.number().min(5).max(50),
    marginLeftMm: z.number().min(5).max(50),
    marginRightMm: z.number().min(5).max(50),
  }),
  header: z.object({
    instituteLine: shortText(200),
    logo: z.enum(['exam-body', 'skans', 'none']),
    dateFormat: z.enum(DATE_FORMATS),
    showBatch: z.boolean(),
    showTeacher: z.boolean(),
    showTest: z.boolean(),
  }),
  instructions: z.object({
    title: shortText(120),
    boxed: z.boolean(),
    numbering: z.enum(['roman', 'number', 'none']),
    lines: z.array(shortText(300)).max(20),
  }),
  sections: z.object({
    enabled: z.boolean(),
    names: z.array(shortText(60).min(1)).max(6),
  }),
  questions: z.object({
    headingPattern: shortText(60).min(1),
    style: z.enum(['block', 'hanging']),
    startOnNewPage: z.boolean(),
    partLabelStyle: z.enum(LABEL_STYLES),
    subPartLabelStyle: z.enum(LABEL_STYLES),
    gapMm: z.number().min(0).max(30),
  }),
  marks: z.object({
    pattern: shortText(40).min(1),
    singularPattern: shortText(40).min(1),
    position: z.enum(['right', 'inline']),
    showMcqItemMarks: z.boolean(),
  }),
  mcq: z.object({
    groupConsecutive: z.boolean(),
    groupIntro: shortText(500),
    trueFalseIntro: shortText(500),
  }),
  runningHeader: z.object({
    enabled: z.boolean(),
    position: z.enum(['top', 'bottom']),
    skipFirstPage: z.boolean(),
    left: shortText(120),
    center: shortText(120),
    right: shortText(120),
  }),
  endText: shortText(60),
  filenames: z.object({
    paper: shortText(120).min(1),
    answerKey: shortText(120).min(1),
  }),
});
export type TemplateConfig = z.infer<typeof templateConfigSchema>;

export const ICAP_TEMPLATE_CONFIG: TemplateConfig = {
  layout: 'ICAP',
  fonts: { body: 'Times', heading: 'Times', runningHeader: 'Calibri', sizePt: 11, lineHeight: 1.15 },
  page: { marginTopMm: 20, marginBottomMm: 16, marginLeftMm: 19, marginRightMm: 19 },
  header: {
    instituteLine: 'Certificate in Accounting and Finance Stage Examination',
    logo: 'exam-body',
    dateFormat: 'D MMMM YYYY',
    showBatch: false,
    showTeacher: false,
    showTest: false,
  },
  instructions: {
    title: 'Instructions to examinees:',
    boxed: true,
    numbering: 'roman',
    lines: [
      'Answer all **{countWord}** questions.',
      'Answer in **black** pen only.',
      'Use the first page of the answer script to answer the Multiple-Choice Questions.',
    ],
  },
  sections: { enabled: true, names: ['SECTION A', 'SECTION B'] },
  questions: {
    headingPattern: 'QUESTION {n}',
    style: 'block',
    startOnNewPage: false,
    partLabelStyle: 'roman',
    subPartLabelStyle: 'alpha',
    gapMm: 6,
  },
  marks: {
    pattern: '({nn} marks)',
    singularPattern: '({nn} mark)',
    position: 'right',
    showMcqItemMarks: false,
  },
  mcq: {
    groupConsecutive: true,
    groupIntro:
      'Select the most appropriate answer from the options provided for each of the following Multiple-Choice Questions (MCQs). Each MCQ carries **ONE** mark.',
    trueFalseIntro: 'State whether each of the following statements is **True** or **False**.',
  },
  runningHeader: {
    enabled: true,
    position: 'top',
    skipFirstPage: true,
    left: '{session} ┃ {subject}',
    center: '',
    right: 'Page {page} of {pages}',
  },
  endText: '(THE END)',
  filenames: { paper: '{code}_{session}_Paper', answerKey: '{code}_{session}_AnswerKey' },
};

export const SKANS_TEMPLATE_CONFIG: TemplateConfig = {
  layout: 'SKANS',
  fonts: { body: 'Arial', heading: 'Times', runningHeader: 'Arial', sizePt: 10.5, lineHeight: 1.2 },
  page: { marginTopMm: 14, marginBottomMm: 16, marginLeftMm: 22, marginRightMm: 16 },
  header: {
    instituteLine: 'SKANS School of Accountancy',
    logo: 'skans',
    dateFormat: 'MM/DD/YYYY',
    showBatch: true,
    showTeacher: true,
    showTest: true,
  },
  instructions: {
    title: 'Instruction:',
    boxed: false,
    numbering: 'roman',
    lines: [
      'Attempt all Questions.',
      'Use Black Ink.',
      'The marker shall take in to account clarity of presentation, logical arrangement and assumption if any.',
      'Start each question using FRESH PAGE.',
    ],
  },
  sections: { enabled: false, names: [] },
  questions: {
    headingPattern: 'Q {n}.',
    style: 'hanging',
    startOnNewPage: false,
    partLabelStyle: 'alpha',
    subPartLabelStyle: 'roman',
    gapMm: 4,
  },
  marks: {
    pattern: '({nn})',
    singularPattern: '({nn})',
    position: 'inline',
    showMcqItemMarks: true,
  },
  mcq: {
    groupConsecutive: true,
    groupIntro: 'Choose the correct answer for each of the following:',
    trueFalseIntro: 'State whether each of the following statements is True or False.',
  },
  runningHeader: {
    enabled: true,
    position: 'bottom',
    skipFirstPage: false,
    left: 'SKANS School of Accountancy · {subject}',
    center: '',
    right: 'Page {page} of {pages}',
  },
  endText: '',
  filenames: { paper: '{code}_Batch{batch}_Test{test}_Paper', answerKey: '{code}_Batch{batch}_Test{test}_AnswerKey' },
};

export const templateInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Z0-9_-]+$/, 'Use capital letters, digits, - or _'),
  name: shortText(120).min(2),
  description: shortText(500).default(''),
  isActive: z.boolean().default(true),
  config: templateConfigSchema,
});
export type TemplateInput = z.infer<typeof templateInputSchema>;
