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
  // 'CAF' = SKANS CAF examination layout (formatting modelled on the reference exam paper);
  // 'SKANS' = SKANS internal test layout. Older saved configs used 'ICAP' for the CAF layout.
  layout: z.preprocess((v) => (v === 'ICAP' ? 'CAF' : v), z.enum(['CAF', 'SKANS'])),
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
    // Only the SKANS logo is supported. The former 'exam-body' option is read as 'skans'.
    logo: z.preprocess((v) => (v === 'exam-body' ? 'skans' : v), z.enum(['skans', 'none'])),
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
  /**
   * Sizes (pt) and vertical spacing (pt) from the approved formatting sheet. Optional, so formats
   * saved by earlier versions keep working with these defaults.
   */
  typography: z
    .object({
      titleSizePt: z.number().min(8).max(30).default(15),
      paperNameSizePt: z.number().min(8).max(30).default(18),
      metaSizePt: z.number().min(8).max(20).default(12),
      instructionsSizePt: z.number().min(8).max(16).default(11),
      sectionSizePt: z.number().min(8).max(16).default(11),
      questionHeadingSizePt: z.number().min(8).max(16).default(11),
      runningHeaderSizePt: z.number().min(7).max(14).default(9.5),
      paragraphSpacingPt: z.number().min(0).max(30).default(12),
      partSpacingPt: z.number().min(0).max(30).default(12),
      stemToOptionsPt: z.number().min(0).max(30).default(8),
      optionSpacingPt: z.number().min(0).max(20).default(0),
      headingToTextPt: z.number().min(0).max(30).default(13),
      sectionToQuestionPt: z.number().min(0).max(40).default(19),
      justify: z.boolean().default(true),
    })
    .default({}),
  endText: shortText(60),
  filenames: z.object({
    paper: shortText(120).min(1),
    answerKey: shortText(120).min(1),
  }),
});
export type TemplateConfig = z.infer<typeof templateConfigSchema>;

/**
 * SKANS CAF examination format. Standard reference: the CAF-8 Audit and Assurance Essentials paper
 * and the administration's formatting sheet: Calisto MT; A4; left margin 2.1 cm, text to 560 pt
 * (right margin about 1.2 cm); running header 1.3 cm from the top; single line spacing; 12 pt
 * between paragraphs and sub-parts; 8 pt from stem to options; 13 pt after QUESTION headings;
 * about 19 pt after SECTION bars.
 */
export const CAF_TEMPLATE_CONFIG: TemplateConfig = {
  layout: 'CAF',
  fonts: { body: 'Calisto', heading: 'Calisto', runningHeader: 'Calibri', sizePt: 11, lineHeight: 1.15 },
  page: { marginTopMm: 22, marginBottomMm: 12, marginLeftMm: 21.4, marginRightMm: 12.4 },
  header: {
    instituteLine: 'Certificate in Accounting and Finance Stage Examination',
    logo: 'skans',
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
    partLabelStyle: 'alpha',
    subPartLabelStyle: 'roman',
    gapMm: 7,
  },
  marks: {
    pattern: '({nn} marks)',
    singularPattern: '({nn} mark)',
    position: 'right',
    showMcqItemMarks: true,
  },
  mcq: {
    groupConsecutive: true,
    groupIntro: 'Select the most appropriate answer from the options provided for each of the following Multiple-Choice Questions.',
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
  typography: {
    titleSizePt: 15,
    paperNameSizePt: 18,
    metaSizePt: 12,
    instructionsSizePt: 11,
    sectionSizePt: 11,
    questionHeadingSizePt: 11,
    runningHeaderSizePt: 9.5,
    paragraphSpacingPt: 12,
    partSpacingPt: 12,
    stemToOptionsPt: 8,
    optionSpacingPt: 0,
    headingToTextPt: 13,
    sectionToQuestionPt: 19,
    justify: true,
  },
  endText: '(THE END)',
  filenames: { paper: '{code}_{session}_Paper', answerKey: '{code}_{session}_AnswerKey' },
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
