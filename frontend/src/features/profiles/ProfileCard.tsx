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
  const classes = [
    'vx-card',
    size === 'lg' ? 'vx-card--lg' : '',
    'vx-anim-pop',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const inner = (
    <>
      {profile.portraitUrl ? (
        <img className="vx-card__pic" src={profile.portraitUrl} alt={label} />
      ) : (
        <span className="vx-card__pic" data-testid="card-placeholder" aria-hidden="true">
          ?
        </span>
      )}
      <span className="vx-card__body">
        <span
          className="vx-card__name"
          style={{ color: profile.card.accentColor || undefined }}
        >
          {label}
        </span>
        {profile.card.tagline && (
          <span className="vx-card__tagline">{profile.card.tagline}</span>
        )}
        <span className="vx-card__meta">{profile.voiceMode}</span>
      </span>
    </>
  );

  if (!onSelect) {
    return (
      <div
        className={classes}
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
      data-testid="profile-card"
      data-active={active ? 'true' : 'false'}
      aria-pressed={selected}
      onClick={() => onSelect(profile.id)}
    >
      {inner}
    </button>
  );
}
