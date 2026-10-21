export const ROLES = ['ADMIN', 'TEACHER'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrator',
  TEACHER: 'Teacher',
};

export const QUESTION_TYPES = ['MCQ', 'MCQ_GROUP', 'TRUE_FALSE', 'SHORT', 'LONG', 'CASE_STUDY'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MCQ: 'MCQ (single answer)',
  MCQ_GROUP: 'MCQ group (shared stem)',
  TRUE_FALSE: 'True / False',
  SHORT: 'Short question',
  LONG: 'Long question (with sub-questions)',
  CASE_STUDY: 'Case study (with sub-questions)',
};

export const QUESTION_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];
export const QUESTION_STATUS_LABELS: Record<QuestionStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DIFFICULTY_LABELS: Record<Difficulty, string> = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' };

export const PAPER_STATUSES = ['DRAFT', 'FINAL'] as const;
export type PaperStatus = (typeof PAPER_STATUSES)[number];

export const FONT_KEYS = ['Times', 'Arial', 'Calibri'] as const;
export type FontKey = (typeof FONT_KEYS)[number];
export const FONT_LABELS: Record<FontKey, string> = {
  Times: 'Times (serif)',
  Arial: 'Arial (sans-serif)',
  Calibri: 'Calibri (sans-serif)',
};

export const DATE_FORMATS = ['D MMMM YYYY', 'MM/DD/YYYY', 'DD/MM/YYYY', 'DD-MMM-YYYY'] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export const MCQ_LAYOUTS = ['auto', '1', '2', '4'] as const;
export type McqLayout = (typeof MCQ_LAYOUTS)[number];

export const LABEL_STYLES = ['roman', 'alpha', 'number'] as const;
export type LabelStyle = (typeof LABEL_STYLES)[number];

/** Actions written to the audit log. */
export const AUDIT_ACTIONS = [
  'LOGIN',
  'LOGIN_FAILED',
  'LOGIN_LOCKED',
  'LOGOUT',
  'PASSWORD_CHANGE',
  'PASSWORD_RESET',
  'USER_CREATE',
  'USER_UPDATE',
  'USER_UNLOCK',
  'SUBJECT_CREATE',
  'SUBJECT_UPDATE',
  'TEMPLATE_CREATE',
  'TEMPLATE_UPDATE',
  'QUESTION_CREATE',
  'QUESTION_UPDATE',
  'QUESTION_SUBMIT',
  'QUESTION_APPROVE',
  'QUESTION_REJECT',
  'QUESTION_DUPLICATE',
  'QUESTION_DELETE',
  'QUESTION_RESTORE',
  'QUESTION_PURGE',
  'QUESTION_IMPORT',
  'PAPER_CREATE',
  'PAPER_UPDATE',
  'PAPER_FINALIZE',
  'PAPER_DUPLICATE',
  'PAPER_DELETE',
  'PAPER_RESTORE_VERSION',
  'PAPER_PDF_DOWNLOAD',
  'ANSWER_KEY_PDF_DOWNLOAD',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * CAF papers taught at SKANS (seeded as subjects; the administration will confirm the final list
 * and full names). `layout` picks the default paper format: 'CAF' = SKANS CAF examination format,
 * 'SKANS' = SKANS internal test format.
 */
export const CA_PAPERS: { code: string; name: string; level: string; layout: 'CAF' | 'SKANS' }[] = [
  { code: 'FAR', name: 'Financial Accounting and Reporting', level: 'CAF', layout: 'CAF' },
  { code: 'FAR1', name: 'Financial Accounting and Reporting I', level: 'CAF', layout: 'CAF' },
  { code: 'FAR2', name: 'Financial Accounting and Reporting II', level: 'CAF', layout: 'CAF' },
  { code: 'AUD', name: 'Audit and Assurance Essentials', level: 'CAF', layout: 'CAF' },
  { code: 'TAX', name: 'Taxation', level: 'CAF', layout: 'SKANS' },
  { code: 'CMA', name: 'Cost and Management Accounting', level: 'CAF', layout: 'CAF' },
  { code: 'BL', name: 'Business Law', level: 'CAF', layout: 'SKANS' },
  { code: 'CL', name: 'Corporate Laws', level: 'CAF', layout: 'SKANS' },
  { code: 'MFA', name: 'Management, Finance and Analytics', level: 'CAF', layout: 'CAF' },
  { code: 'DSR', name: 'Data, Systems and Risks', level: 'CAF', layout: 'SKANS' },
  { code: 'TPC', name: 'Tax Practices and Compliance', level: 'CAF', layout: 'SKANS' },
  { code: 'BLD', name: 'Business Laws and Documentation', level: 'CAF', layout: 'SKANS' },
  { code: 'MA', name: 'Management Accounting', level: 'CAF', layout: 'CAF' },
  { code: 'BIA', name: 'Business Insights and Analytics', level: 'CAF', layout: 'CAF' },
];
