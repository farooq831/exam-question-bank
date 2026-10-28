import { describe, expect, it } from 'vitest';
import type { SessionUser } from '@skans/shared';
import { defaultOptions, draftMarks, draftPayload, emptyDraft, hasText, newGroupItem, newPart, questionActions, validateDraft, type QuestionDraft } from '../src/questions/model';
import { questionTitle } from '../src/questions/QuestionPreview';

const draft = (patch: Partial<QuestionDraft>): QuestionDraft => ({ ...emptyDraft(1), body: '<p>Question</p>', ...patch });
const filled = () => defaultOptions().map((o, i) => ({ ...o, html: `<p>Option ${i}</p>` }));

describe('question editor rules (validateDraft)', () => {
  it('accepts a complete short question', () => {
    expect(validateDraft(draft({}))).toEqual([]);
  });

  it('requires question text; empty paragraphs and spaces do not count', () => {
    expect(validateDraft(draft({ body: '<p> &nbsp; </p>' }))).toContain('Enter the question text.');
  });

  it('counts a table alone as question text', () => {
    expect(hasText('<table><tbody><tr><td><p></p></td></tr></tbody></table>')).toBe(true);
  });

  it('MCQ: needs exactly one correct option, text in every option, 2 to 6 options', () => {
    expect(validateDraft(draft({ type: 'MCQ', options: filled() }))).toEqual([]);
    const none = filled().map((o) => ({ ...o, correct: false }));
    expect(validateDraft(draft({ type: 'MCQ', options: none }))).toContain('Options: mark exactly one correct option.');
    const two = filled().map((o) => ({ ...o, correct: true }));
    expect(validateDraft(draft({ type: 'MCQ', options: two }))).toContain('Options: mark exactly one correct option.');
    const blank = filled();
    blank[2].html = '<p></p>';
    expect(validateDraft(draft({ type: 'MCQ', options: blank }))).toContain('Options: every option needs text.');
    expect(validateDraft(draft({ type: 'MCQ', options: filled().slice(0, 1) }))).toContain('Options: use between 2 and 6 options.');
  });

  it('MCQ set: needs at least one item, and checks each item', () => {
    expect(validateDraft(draft({ type: 'MCQ_GROUP', groupItems: [] }))).toContain('Add at least one MCQ to the group.');
    const item = { ...newGroupItem(), stem: '', options: filled() };
    expect(validateDraft(draft({ type: 'MCQ_GROUP', groupItems: [item] }))).toContain('MCQ 1: enter the question text.');
  });

  it('long question: every part needs text', () => {
    const errors = validateDraft(draft({ type: 'LONG', parts: [{ ...newPart(), html: '' }] }));
    expect(errors).toContain('Every part needs text (or remove empty parts).');
  });

  it('marks must be greater than zero', () => {
    expect(validateDraft(draft({ marks: 0 }))).toContain('Marks must be greater than zero.');
  });
});

describe('marks', () => {
  it('long question marks are the sum of its parts', () => {
    const parts = [{ ...newPart(), html: '<p>a</p>', marks: 4 }, { ...newPart(), html: '<p>b</p>', marks: 6 }];
    expect(draftMarks(draft({ type: 'LONG', marks: 99, parts }))).toBe(10);
  });

  it('MCQ set marks are the sum of its items', () => {
    const items = [{ ...newGroupItem(), marks: 2 }, { ...newGroupItem(), marks: 3 }];
    expect(draftMarks(draft({ type: 'MCQ_GROUP', groupItems: items }))).toBe(5);
  });

  it('True / False payload carries the correct answer', () => {
    expect(draftPayload(draft({ type: 'TRUE_FALSE', tfCorrect: false })).content).toEqual({ correct: false });
  });
});

describe('who may do what (questionActions mirrors the server)', () => {
  const teacher = { id: 2, role: 'TEACHER', subjectIds: [1] } as unknown as SessionUser;
  const admin = { id: 1, role: 'ADMIN', subjectIds: [] } as unknown as SessionUser;
  const q = (patch: object) => ({ status: 'DRAFT', createdById: 2, subjectId: 1, deletedAt: null, ...patch }) as Parameters<typeof questionActions>[1];

  it('teacher can edit, submit and delete own draft', () => {
    expect(questionActions(teacher, q({}))).toMatchObject({ edit: true, submit: true, remove: true, review: false });
  });

  it('teacher cannot edit or delete an approved question, or edit one in review', () => {
    expect(questionActions(teacher, q({ status: 'APPROVED' }))).toMatchObject({ edit: false, remove: false });
    expect(questionActions(teacher, q({ status: 'SUBMITTED' }))).toMatchObject({ edit: false, submit: false });
  });

  it("teacher cannot touch another teacher's question or another subject", () => {
    expect(questionActions(teacher, q({ createdById: 9 }))).toMatchObject({ edit: false, remove: false, submit: false });
    expect(questionActions(teacher, q({ subjectId: 5 }))).toMatchObject({ edit: false, duplicate: false });
  });

  it('admin reviews submitted questions and can edit anything', () => {
    expect(questionActions(admin, q({ status: 'SUBMITTED' }))).toMatchObject({ edit: true, review: true });
  });

  it('binned question: only restore or delete permanently', () => {
    expect(questionActions(teacher, q({ deletedAt: '2026-10-01' }))).toMatchObject({ edit: false, restore: true, purge: true, remove: false });
  });
});

describe('question titles in lists', () => {
  it('uses the title, otherwise the text without tables, otherwise the type', () => {
    expect(questionTitle({ topic: 'Leases', body: '<p>x</p>', type: 'LONG' })).toBe('Leases');
    expect(questionTitle({ topic: '', body: '<p>Explain IFRS 16</p><table><tr><td>99</td></tr></table>', type: 'LONG' })).toBe('Explain IFRS 16');
    expect(questionTitle({ topic: '', body: '', type: 'MCQ' })).toBe('MCQ question');
  });
});
