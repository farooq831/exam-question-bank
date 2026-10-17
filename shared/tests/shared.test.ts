import { describe, expect, it } from 'vitest';
import {
  checkPaperMarks,
  computeQuestionMarks,
  fillTokens,
  formatDate,
  formatDurationIcap,
  formatDurationSkans,
  formatMarks,
  ICAP_TEMPLATE_CONFIG,
  partLabel,
  questionInputSchema,
  safeFileName,
  SKANS_TEMPLATE_CONFIG,
  templateConfigSchema,
} from '../src';

describe('marks total validation', () => {
  it('reports a match when total equals maximum', () => {
    const r = checkPaperMarks([10, 10, 8, 8, 8, 6, 15, 20, 15], 100);
    expect(r.status).toBe('match');
    expect(r.total).toBe(100);
  });

  it('warns when total is under the maximum (SKANS tax test: 18 of 20)', () => {
    const r = checkPaperMarks([3, 5, 5, 5], 20);
    expect(r.status).toBe('under');
    expect(r.difference).toBe(-2);
    expect(r.message).toContain('2 mark(s) short');
  });

  it('warns when total is over the maximum', () => {
    const r = checkPaperMarks([60, 50.5], 100);
    expect(r.status).toBe('over');
    expect(r.difference).toBe(10.5);
  });

  it('flags an empty paper', () => {
    expect(checkPaperMarks([], 100).status).toBe('empty');
  });

  it('derives question marks from parts and group items', () => {
    expect(
      computeQuestionMarks(
        'LONG',
        {
          parts: [
            { marks: 4, parts: [] },
            { marks: 0, parts: [{ marks: 6 }, { marks: 3 }] },
          ],
        },
        99,
      ),
    ).toBe(13);
    expect(computeQuestionMarks('MCQ_GROUP', { items: [{ marks: 1 }, { marks: 2 }] }, 0)).toBe(3);
    expect(computeQuestionMarks('SHORT', {}, 5)).toBe(5);
  });
});

describe('formatting helpers', () => {
  it('formats marks with ICAP and SKANS patterns', () => {
    expect(formatMarks(8, '({nn} marks)', '({nn} mark)')).toBe('(08 marks)');
    expect(formatMarks(1, '({nn} marks)', '({nn} mark)')).toBe('(01 mark)');
    expect(formatMarks(15, '({nn} marks)')).toBe('(15 marks)');
    expect(formatMarks(5, '({nn})')).toBe('(05)');
  });

  it('formats dates and durations', () => {
    expect(formatDate('2026-03-02', 'D MMMM YYYY')).toBe('2 March 2026');
    expect(formatDate('2025-10-20', 'MM/DD/YYYY')).toBe('10/20/2025');
    expect(formatDurationIcap(180, 15)).toBe("3 hours and 15 minutes (including 15 minutes' reading time)");
    expect(formatDurationSkans(60)).toBe('1 Hour(s)');
  });

  it('labels parts and fills tokens', () => {
    expect(partLabel(4, 'roman')).toBe('(iv)');
    expect(partLabel(2, 'alpha')).toBe('(b)');
    expect(fillTokens('{code}_{session}_Paper', { code: 'FAR', session: 'Spring 2026' })).toBe('FAR_Spring 2026_Paper');
    expect(safeFileName('FAR_Spring 2026_Paper')).toBe('FAR_Spring2026_Paper');
  });
});

describe('schemas', () => {
  it('accepts the seeded default templates', () => {
    expect(templateConfigSchema.safeParse(ICAP_TEMPLATE_CONFIG).success).toBe(true);
    expect(templateConfigSchema.safeParse(SKANS_TEMPLATE_CONFIG).success).toBe(true);
  });

  it('requires exactly one correct MCQ option', () => {
    const base = {
      subjectId: 1,
      type: 'MCQ' as const,
      marks: 1,
      body: '<p>Q</p>',
      content: {
        options: [
          { key: 'a', html: 'A', correct: true },
          { key: 'b', html: 'B', correct: true },
        ],
      },
    };
    expect(questionInputSchema.safeParse(base).success).toBe(false);
    base.content.options[1].correct = false;
    expect(questionInputSchema.safeParse(base).success).toBe(true);
  });
});
