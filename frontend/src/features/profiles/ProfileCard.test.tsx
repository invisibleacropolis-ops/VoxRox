import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Profile } from '@/api/types';
import { ProfileCard } from './ProfileCard';

const PROFILE: Profile = {
  id: 'p1',
  name: 'Ivy Thorn',
  createdAt: 'x',
  updatedAt: 'x',
  portraitUrl: null,
  card: { shortName: 'Ivy', tagline: 'Ranger of the marsh', accentColor: '#6fe3a1' },
  voiceMode: 'design',
  voice: {
    gender: 'female', age: 'young adult', pitch: 'low', style: '',
    accent: '', dialect: '', mood: '', intensity: 2, extra: [],
  },
  params: { numStep: 32, speed: 1, duration: null },
  samples: [],
  activeSampleId: null,
  narrative: { description: '', background: '' },
  customTags: [],
  archive: [],
};

describe('ProfileCard', () => {
  it('shows the short name and tagline', () => {
    render(<ProfileCard profile={PROFILE} />);
    expect(screen.getByText('Ivy')).toBeInTheDocument();
    expect(screen.getByText('Ranger of the marsh')).toBeInTheDocument();
  });

  it('shows the voice mode as meta text', () => {
    render(<ProfileCard profile={PROFILE} />);
    expect(screen.getByText('design')).toBeInTheDocument();
  });

  it('renders a placeholder glyph when there is no portrait', () => {
    render(<ProfileCard profile={PROFILE} />);
    expect(screen.getByTestId('card-placeholder')).toBeInTheDocument();
  });

  it('renders an img when a portrait exists', () => {
    render(<ProfileCard profile={{ ...PROFILE, portraitUrl: '/media/portraits/a.png' }} />);
    expect(screen.getByRole('img', { name: 'Ivy' })).toHaveAttribute(
      'src',
      '/media/portraits/a.png',
    );
  });

  it('is a button that fires onSelect when selectable', async () => {
    const onSelect = vi.fn();
    render(<ProfileCard profile={PROFILE} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith('p1');
  });

  it('is not a button when there is no onSelect', () => {
    render(<ProfileCard profile={PROFILE} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('reports the selected state', () => {
    render(<ProfileCard profile={PROFILE} onSelect={() => {}} selected />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks itself active for the sequencer highlight', () => {
    render(<ProfileCard profile={PROFILE} active />);
    expect(screen.getByTestId('profile-card')).toHaveAttribute('data-active', 'true');
  });

  it('falls back to the full name when shortName is blank', () => {
    render(
      <ProfileCard profile={{ ...PROFILE, card: { ...PROFILE.card, shortName: '' } }} />,
    );
    expect(screen.getByText('Ivy Thorn')).toBeInTheDocument();
  });
});
