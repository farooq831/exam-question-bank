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

export const FONT_KEYS = ['Calisto', 'Times', 'Arial', 'Calibri'] as const;
export type FontKey = (typeof FONT_KEYS)[number];
export const FONT_LABELS: Record<FontKey, string> = {
  Calisto: 'Calisto MT (serif)',
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
 * CAF papers set by SKANS (official names as printed on the papers). Group A = CAF 1-4,
 * Group B = CAF 5-8. `level` stores the CAF number ("CAF 1" ... "CAF 8"); `layout` picks the
 * default paper format ('CAF' = SKANS CAF examination format).
 */
export const CA_PAPERS: { code: string; name: string; level: string; group: 'A' | 'B'; layout: 'CAF' | 'SKANS' }[] = [
  { code: 'FAR', name: 'Financial Accounting and Reporting', level: 'CAF 1', group: 'A', layout: 'CAF' },
  { code: 'TPC', name: 'Taxation Principles and Compliance', level: 'CAF 2', group: 'A', layout: 'CAF' },
  { code: 'DSR', name: 'Data, Systems and Risks', level: 'CAF 3', group: 'A', layout: 'CAF' },
  { code: 'BLD', name: 'Business Law Dynamics', level: 'CAF 4', group: 'A', layout: 'CAF' },
  { code: 'MA', name: 'Management Accounting', level: 'CAF 5', group: 'B', layout: 'CAF' },
  { code: 'CR', name: 'Corporate Reporting', level: 'CAF 6', group: 'B', layout: 'CAF' },
  { code: 'BIA', name: 'Business Insights and Analysis', level: 'CAF 7', group: 'B', layout: 'CAF' },
  { code: 'AAE', name: 'Audit and Assurance Essentials', level: 'CAF 8', group: 'B', layout: 'CAF' },
];

/** CAF group of a subject level such as "CAF 3" (A = CAF 1-4, B = CAF 5-8). */
export function cafGroup(level: string): 'A' | 'B' | null {
  const m = /^CAF\s*(\d+)$/i.exec(level.trim());
  if (!m) return null;
  return Number(m[1]) <= 4 ? 'A' : 'B';
}

/** Subject codes seeded by earlier versions that are no longer part of the CAF list. */
export const LEGACY_SUBJECT_CODES = ['FAR1', 'FAR2', 'AUD', 'TAX', 'CMA', 'BL', 'CL', 'MFA'];
