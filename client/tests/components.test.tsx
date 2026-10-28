import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Confirm } from '../src/components/Confirm';
import { Modal } from '../src/components/Modal';
import { PasswordInput } from '../src/components/PasswordInput';
import { Chips, Pager } from '../src/components/ui';
import { StatusBadge } from '../src/questions/StatusBadge';

describe('PasswordInput', () => {
  it('hides the password, and the eye button shows and hides it', async () => {
    render(<PasswordInput aria-label="Password" defaultValue="Secret123" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('can start visible (temporary passwords)', () => {
    render(<PasswordInput aria-label="Password" initiallyVisible />);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
  });
});

describe('Confirm dialog', () => {
  it('shows nothing when closed', () => {
    render(<Confirm open={false} title="Delete?" message="Gone" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('calls confirm or cancel', async () => {
    const onConfirm = vi.fn(), onCancel = vi.fn();
    render(<Confirm open title="Delete permanently?" message="This cannot be undone." confirmLabel="Delete" danger onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

describe('Modal window', () => {
  it('Escape and the cross close it', async () => {
    const onClose = vi.fn();
    render(<Modal title="New question" onClose={onClose}><p>Body</p></Modal>);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('minimise keeps what was typed and restores it', async () => {
    render(<Modal title="New question" onClose={() => {}}><input aria-label="Title" /></Modal>);
    await userEvent.type(screen.getByLabelText('Title'), 'Leases');
    await userEvent.click(screen.getByRole('button', { name: 'Minimise' }));
    expect(screen.getByRole('region', { name: 'Minimised window' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(screen.queryByRole('region', { name: 'Minimised window' })).toBeNull();
    expect(screen.getByLabelText('Title')).toHaveValue('Leases');
  });

  it('maximise switches to restore down; small dialogs have no window buttons', async () => {
    const { unmount } = render(<Modal title="Paper" onClose={() => {}}>x</Modal>);
    await userEvent.click(screen.getByRole('button', { name: 'Maximise' }));
    expect(screen.getByRole('button', { name: 'Restore down' })).toBeInTheDocument();
    unmount();
    render(<Modal title="Small" size="md" onClose={() => {}}>x</Modal>);
    expect(screen.queryByRole('button', { name: 'Minimise' })).toBeNull();
  });
});

describe('small UI parts', () => {
  it('status badge shows teacher-friendly words', () => {
    render(<><StatusBadge status="SUBMITTED" /><StatusBadge status="REJECTED" /></>);
    expect(screen.getByText('In review')).toBeInTheDocument();
    expect(screen.getByText('Returned')).toBeInTheDocument();
  });

  it('filter chips report the chosen value', async () => {
    const onChange = vi.fn();
    render(<Chips options={[{ value: 'ALL', label: 'All' }, { value: 'DRAFT', label: 'Drafts' }]} value="ALL" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Drafts' }));
    expect(onChange).toHaveBeenCalledWith('DRAFT');
  });

  it('pager moves between pages', async () => {
    const onPage = vi.fn();
    render(<Pager page={2} pages={3} onPage={onPage} />);
    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[buttons.length - 1]);
    expect(onPage).toHaveBeenCalledWith(3);
  });
});
