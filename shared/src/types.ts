import type { Difficulty, PaperStatus, QuestionStatus, QuestionType, Role } from './constants';
import type { PaperHeader } from './schemas';
import type { TemplateConfig } from './template';

/** API data-transfer objects shared by client and server. */

export interface SessionUser {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  mustChangePassword: boolean;
  subjectIds: number[];
}

export interface SubjectDTO {
  id: number;
  code: string;
  name: string;
  level: string;
  isActive: boolean;
  templateId: number | null;
  templateName?: string | null;
}

export interface UserDTO {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  role: Role;
  isActive: boolean;
  lockedUntil: string | null;
  failedLogins: number;
  lastLoginAt: string | null;
  createdAt: string;
  subjectIds: number[];
}

export interface QuestionDTO {
  id: number;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  topic: string;
  type: QuestionType;
  marks: number;
  difficulty: Difficulty;
  source: string;
  body: string;
  content: Record<string, unknown>;
  answer: string;
  advice: string;
  comments: string;
  status: QuestionStatus;
  reviewComment: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdById: number;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  usedInPapers?: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TemplateDTO {
  id: number;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  config: TemplateConfig;
  subjectCodes: string[];
  updatedAt: string;
}

export interface PaperItemDTO {
  id: number;
  questionId: number;
  section: string;
  position: number;
  marksOverride: number | null;
  newPage: boolean;
  question: QuestionDTO;
}

export interface PaperSummaryDTO {
  id: number;
  title: string;
  subjectId: number;
  subjectCode: string;
  templateId: number;
  templateName: string;
  status: PaperStatus;
  totalMarks: number;
  maxMarks: number;
  questionCount: number;
  currentVersion: number;
  createdBy: string;
  updatedAt: string;
}

export interface PaperDTO extends PaperSummaryDTO {
  header: PaperHeader;
  items: PaperItemDTO[];
}

export interface PaperVersionDTO {
  id: number;
  version: number;
  note: string;
  createdBy: string;
  createdAt: string;
  status: PaperStatus;
  totalMarks: number;
  questionCount: number;
}

export interface AuditLogDTO {
  id: number;
  username: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  ip: string;
  createdAt: string;
}

export interface DashboardDTO {
  role: Role;
  countsBySubject: {
    subjectId: number;
    code: string;
    name: string;
    DRAFT: number;
    SUBMITTED: number;
    APPROVED: number;
    REJECTED: number;
  }[];
  totals: Record<QuestionStatus, number>;
  pendingReview: number;
  myRejected: number;
  recentPapers: PaperSummaryDTO[];
  recentActivity: AuditLogDTO[];
  stats: { users?: number; subjects?: number; templates?: number; papers?: number };
}

export interface ImportReport {
  dryRun: boolean;
  totalRows: number;
  imported: number;
  errors: { row: number; field: string; message: string }[];
  warnings: { row: number; message: string }[];
}
