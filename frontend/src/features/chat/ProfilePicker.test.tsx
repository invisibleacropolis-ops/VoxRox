import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Profile } from '@/api/types';
import { ProfilePicker } from './ProfilePicker';

function makeProfile(id: string, name: string): Profile {
  return {
    id, name, createdAt: 'x', updatedAt: 'x', portraitUrl: null,
    card: { shortName: name, tagline: '', accentColor: '#f2c14e' },
    voiceMode: 'auto',
    voice: { gender: '', age: '', pitch: '', style: '', accent: '',
             dialect: '', mood: '', intensity: 2, extra: [] },
    params: { numStep: 32, speed: 1, duration: null },
    samples: [], activeSampleId: null,
    narrative: { description: '', background: '' },
    customTags: [], archive: [],
  };
}

const PROFILES = [makeProfile('p1', 'Ivy'), makeProfile('p2', 'Rook')];

describe('ProfilePicker', () => {
  it('renders nothing when closed', () => {
    render(
      <ProfilePicker open={false} profiles={PROFILES} onPick={() => {}} onClose={() => {}} />,
    );
    expect(screen.queryByText('Ivy')).not.toBeInTheDocument();
  });

  it('renders one card per profile in a grid', () => {
    render(
      <ProfilePicker open profiles={PROFILES} onPick={() => {}} onClose={() => {}} />,
    );
    expect(screen.getAllByTestId('profile-card')).toHaveLength(2);
  });

  it('calls onPick with the chosen profile id', async () => {
    const onPick = vi.fn();
    render(<ProfilePicker open profiles={PROFILES} onPick={onPick} onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /Rook/ }));
    expect(onPick).toHaveBeenCalledWith('p2');
  });

  it('prompts when there are no profiles', () => {
    render(<ProfilePicker open profiles={[]} onPick={() => {}} onClose={() => {}} />);
    expect(screen.getByText(/create a character first/i)).toBeInTheDocument();
  });

  it('closes from the title bar', async () => {
    const onClose = vi.fn();
    render(<ProfilePicker open profiles={PROFILES} onPick={() => {}} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /^Close/ }));
    expect(onClose).toHaveBeenCalled();
  });
});
