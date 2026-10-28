import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubjectDTO } from '@skans/shared';

const apiMock = vi.hoisted(() => vi.fn());
vi.mock('../src/api', async (orig) => ({ ...(await orig<typeof import('../src/api')>()), api: apiMock }));

import { QuestionEditor } from '../src/questions/QuestionEditor';
import { emptyDraft } from '../src/questions/model';

const subjects = [{ id: 1, code: 'FAR', name: 'Financial Accounting and Reporting' }] as unknown as SubjectDTO[];
const open = (patch = {}) => {
  const onSaved = vi.fn();
  render(<QuestionEditor initial={{ ...emptyDraft(1), ...patch }} subjects={subjects} canSubmit onClose={() => {}} onSaved={onSaved} />);
  return onSaved;
};

beforeEach(() => apiMock.mockReset());

describe('QuestionEditor', () => {
  it('shows all six question types', () => {
    open();
    for (const name of [/^MCQ/, /MCQ set/, /True \/ False/, /^Short/, /^Long/, /Case study/]) {
      expect(screen.getAllByRole('radio', { name }).length).toBeGreaterThan(0);
    }
  });

  it('does not send an incomplete question; explains what is missing', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Enter the question text.')).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('switching to MCQ shows four options and checks them before saving', async () => {
    open({ body: '<p>Which is the first step?</p>' });
    await userEvent.click(screen.getAllByRole('radio', { name: /^MCQ/ })[0]);
    for (const k of ['a', 'b', 'c', 'd']) expect(screen.getByLabelText(`Option ${k}`)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Options: every option needs text.')).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('saves a complete question as a draft through the API', async () => {
    apiMock.mockResolvedValue({ id: 7, status: 'DRAFT' });
    const onSaved = open({ body: '<p>Explain going concern.</p>', topic: 'Going concern', marks: 6 });
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [path, init] = apiMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/questions');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toMatchObject({ type: 'SHORT', topic: 'Going concern', marks: 6, subjectId: 1 });
  });

  it('Submit sends it for review (?submit=1)', async () => {
    apiMock.mockResolvedValue({ id: 8, status: 'SUBMITTED' });
    open({ body: '<p>Explain going concern.</p>' });
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(apiMock).toHaveBeenCalled());
    expect(apiMock.mock.calls[0][0]).toBe('/questions?submit=1');
  });
});
