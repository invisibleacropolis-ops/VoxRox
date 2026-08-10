import type { Profile } from '@/api/types';
import { ProfileCard } from '@/features/profiles/ProfileCard';
import { PixelWindow } from '@/ui/primitives/PixelWindow';
import './chat.css';

export interface ProfilePickerProps {
  open: boolean;
  profiles: Profile[];
  onPick: (profileId: string) => void;
  onClose: () => void;
}

export function ProfilePicker({ open, profiles, onPick, onClose }: ProfilePickerProps) {
  return (
    <PixelWindow open={open} title="Choose a character" modal onClose={onClose}>
      {profiles.length === 0 ? (
        <div className="vx-empty">create a character first on the Profiles screen</div>
      ) : (
        <div className="vx-picker__grid">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              size="lg"
              onSelect={onPick}
            />
          ))}
        </div>
      )}
    </PixelWindow>
  );
}
