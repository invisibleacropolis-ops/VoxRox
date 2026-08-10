import type React from 'react';
import type { Profile } from '@/api/types';
import './profiles.css';

export interface ProfileCardProps {
  profile: Profile;
  onSelect?: (id: string) => void;
  selected?: boolean;
  active?: boolean;
  size?: 'md' | 'lg';
  className?: string;
}

export function ProfileCard({
  profile,
  onSelect,
  selected = false,
  active = false,
  size = 'md',
  className = '',
}: ProfileCardProps) {
  const label = profile.card.shortName || profile.name;
  const accent = profile.card.accentColor || '#f2c14e';
  const classes = [
    'vx-card',
    size === 'lg' ? 'vx-card--lg' : '',
    'vx-anim-bounce',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const inner = (
    <span className="vx-card__inner vx-glint">
      {profile.portraitUrl ? (
        <img className="vx-card__pic" src={profile.portraitUrl} alt={label} />
      ) : (
        <span className="vx-card__pic" data-testid="card-placeholder" aria-hidden="true">
          ?
        </span>
      )}
      <span className="vx-card__body">
        <span className="vx-card__name" style={{ color: accent }}>
          {label}
        </span>
        {profile.card.tagline && (
          <span className="vx-card__tagline">{profile.card.tagline}</span>
        )}
        <span className="vx-card__meta">{profile.voiceMode}</span>
      </span>
    </span>
  );

  const style = { '--accent': accent } as React.CSSProperties;

  if (!onSelect) {
    return (
      <div
        className={classes}
        style={style}
        data-testid="profile-card"
        data-active={active ? 'true' : 'false'}
      >
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      style={style}
      data-testid="profile-card"
      data-active={active ? 'true' : 'false'}
      aria-pressed={selected}
      onClick={() => onSelect(profile.id)}
    >
      {inner}
    </button>
  );
}
