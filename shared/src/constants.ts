export const ROLES = ['ADMIN', 'HOA', 'TEACHER'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrator',
  HOA: 'Head of Academics',
  TEACHER: 'Teacher',
};

export const QUESTION_TYPES = ['MCQ', 'MCQ_GROUP', 'TRUE_FALSE', 'SHORT', 'LONG', 'CASE_STUDY'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MCQ: 'MCQ (single answer)',
  MCQ_GROUP: 'MCQ group (shared stem)',
  TRUE_FALSE: 'True / False',
  SHORT: 'Short question',
  LONG: 'Long question (with parts)',
  CASE_STUDY: 'Case study',
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
 * Chartered Accountancy papers known to the system. The school teaches CAF only; PRC entries are
 * kept for reference and are not seeded. `layout` picks the default format: 'ICAP' is the internal
 * key of the "CAF Examination Paper" format, 'SKANS' of the "SKANS Internal Test" format.
 */
export const CA_PAPERS: { code: string; name: string; level: string; layout: 'ICAP' | 'SKANS' }[] = [
  { code: 'FAR', name: 'Financial Accounting and Reporting', level: 'CAF', layout: 'ICAP' },
  { code: 'FAR1', name: 'Financial Accounting and Reporting I', level: 'CAF', layout: 'ICAP' },
  { code: 'FAR2', name: 'Financial Accounting and Reporting II', level: 'CAF', layout: 'ICAP' },
  { code: 'AUD', name: 'Audit and Assurance Essentials', level: 'CAF', layout: 'ICAP' },
  { code: 'TAX', name: 'Taxation', level: 'CAF', layout: 'SKANS' },
  { code: 'CMA', name: 'Cost and Management Accounting', level: 'CAF', layout: 'ICAP' },
  { code: 'BL', name: 'Business Law', level: 'CAF', layout: 'SKANS' },
  { code: 'CL', name: 'Corporate Laws', level: 'CAF', layout: 'SKANS' },
  { code: 'MFA', name: 'Management, Finance and Analytics', level: 'CAF', layout: 'ICAP' },
  { code: 'DSR', name: 'Data, Systems and Risks', level: 'CAF', layout: 'SKANS' },
  { code: 'TPC', name: 'Tax Practices and Compliance', level: 'CAF', layout: 'SKANS' },
  { code: 'BLD', name: 'Business Laws and Documentation', level: 'CAF', layout: 'SKANS' },
  { code: 'MA', name: 'Management Accounting', level: 'CAF', layout: 'ICAP' },
  { code: 'CR', name: 'Corporate Reporting', level: 'PRC', layout: 'ICAP' },
  { code: 'BIA', name: 'Business Insights and Analytics', level: 'CAF', layout: 'ICAP' },
  { code: 'AAE', name: 'Advanced Audit and Ethics', level: 'PRC', layout: 'ICAP' },
  { code: 'SBM', name: 'Strategic Business Management', level: 'PRC', layout: 'ICAP' },
  { code: 'ATP', name: 'Advanced Taxation Practices', level: 'PRC', layout: 'SKANS' },
];
