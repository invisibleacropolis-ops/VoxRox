import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import { PixelTransport } from './PixelTransport';

describe('PixelTransport', () => {
  it('shows the placeholder and disables play when there is no source', () => {
    render(<PixelTransport src={null} name="no audio yet" />);
    expect(screen.getByText('no audio yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
  });

  it('renders a play button and an audio element for a source', () => {
    const { container } = render(<PixelTransport src="/media/a.wav" name="a.wav" />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
    expect(container.querySelector('audio')).toHaveAttribute('src', '/media/a.wav');
  });

  it('calls play on the audio element and swaps to Pause', async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.play = play;
    render(<PixelTransport src="/media/a.wav" name="a.wav" />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(play).toHaveBeenCalled();
    const audio = document.querySelector('audio')!;
    fireEvent.play(audio);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('shows current and total time', () => {
    render(<PixelTransport src="/media/a.wav" name="a.wav" durationSec={65} />);
    expect(screen.getByText('0:00 / 1:05')).toBeInTheDocument();
  });

  it('updates elapsed time on timeupdate', () => {
    render(<PixelTransport src="/media/a.wav" name="a.wav" durationSec={65} />);
    const audio = document.querySelector('audio') as HTMLAudioElement;
    Object.defineProperty(audio, 'currentTime', { value: 12, configurable: true });
    fireEvent.timeUpdate(audio);
    expect(screen.getByText('0:12 / 1:05')).toBeInTheDocument();
  });

  it('resets to Play when playback ends', () => {
    render(<PixelTransport src="/media/a.wav" name="a.wav" />);
    const audio = document.querySelector('audio') as HTMLAudioElement;
    fireEvent.play(audio);
    fireEvent.ended(audio);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('stop rewinds and pauses', () => {
    render(<PixelTransport src="/media/a.wav" name="a.wav" />);
    const audio = document.querySelector('audio') as HTMLAudioElement;
    audio.currentTime = 5;
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(audio.currentTime).toBe(0);
  });

  it('offers a download link when downloadable', () => {
    render(<PixelTransport src="/media/a.wav" name="a.wav" downloadable />);
    expect(screen.getByRole('link', { name: 'Download a.wav' })).toHaveAttribute(
      'href',
      '/media/a.wav',
    );
  });
});
