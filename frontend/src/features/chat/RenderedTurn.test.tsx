import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Profile, Turn } from '@/api/types';
import { RenderedTurn } from './RenderedTurn';

const PROFILE: Profile = {
  id: 'p1', name: 'Ivy Thorn', createdAt: 'x', updatedAt: 'x', portraitUrl: null,
  card: { shortName: 'Ivy', tagline: '', accentColor: '#f2c14e' },
  voiceMode: 'auto',
  voice: { gender: '', age: '', pitch: '', style: '', accent: '',
           dialect: '', mood: '', intensity: 2, extra: [] },
  params: { numStep: 32, speed: 1, duration: null },
  samples: [], activeSampleId: null,
  narrative: { description: '', background: '' },
  customTags: [], archive: [],
};

const RENDERED: Turn = {
  id: 't1', profileId: 'p1', text: 'Hello [laughter] world',
  params: { numStep: 32, speed: 1, duration: null },
  voiceOverride: null, status: 'rendered',
  audio: { url: '/media/renders/proj1/t1.wav', filename: 't1.wav',
           durationSec: 1.5, sampleRate: 24000, peaks: [0.2, 0.9, 0.4], renderedAt: 'x' },
  createdAt: 'x', updatedAt: 'x',
};

const DRAFT: Turn = { ...RENDERED, id: 't2', status: 'draft', audio: null };

describe('RenderedTurn', () => {
  it('shows the typed text including tags', () => {
    render(<RenderedTurn turn={RENDERED} profile={PROFILE} />);
    expect(screen.getByTestId('turn-text')).toHaveTextContent('Hello [laughter] world');
  });

  it('highlights tags in their own element', () => {
    render(<RenderedTurn turn={RENDERED} profile={PROFILE} />);
    expect(screen.getByText('[laughter]')).toHaveClass('vx-turn__tag');
  });

  it('shows the speaker name', () => {
    render(<RenderedTurn turn={RENDERED} profile={PROFILE} />);
    expect(screen.getByText('Ivy')).toBeInTheDocument();
  });

  it('renders a transport bound to the audio url', () => {
    const { container } = render(<RenderedTurn turn={RENDERED} profile={PROFILE} />);
    expect(container.querySelector('audio')).toHaveAttribute(
      'src',
      '/media/renders/proj1/t1.wav',
    );
  });

  it('labels a draft turn as not yet rendered', () => {
    render(<RenderedTurn turn={DRAFT} profile={PROFILE} />);
    expect(screen.getByText('not rendered')).toBeInTheDocument();
  });

  it('fires onEdit and onDelete', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <RenderedTurn turn={RENDERED} profile={PROFILE} onEdit={onEdit} onDelete={onDelete} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onEdit).toHaveBeenCalledWith('t1');
    expect(onDelete).toHaveBeenCalledWith('t1');
  });

  it('marks itself active for the sequencer', () => {
    render(<RenderedTurn turn={RENDERED} profile={PROFILE} active />);
    expect(screen.getByTestId('turn')).toHaveAttribute('data-active', 'true');
  });

  it('renders without a profile', () => {
    render(<RenderedTurn turn={RENDERED} profile={undefined} />);
    expect(screen.getByText('unknown speaker')).toBeInTheDocument();
  });
});
