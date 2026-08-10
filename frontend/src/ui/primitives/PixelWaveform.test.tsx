import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import { PixelWaveform } from './PixelWaveform';

const PEAKS = [0.1, 0.5, 1, 0.75, 0.25];

describe('PixelWaveform', () => {
  it('draws two bars per peak — the dim layer and the played layer', () => {
    const { container } = render(<PixelWaveform peaks={PEAKS} progress={0.5} />);
    const layers = container.querySelectorAll('svg > g');
    expect(layers).toHaveLength(2);
    expect(layers[0].querySelectorAll('rect')).toHaveLength(PEAKS.length);
    expect(layers[1].querySelectorAll('rect')).toHaveLength(PEAKS.length);
  });

  it('clips the played layer to the progress fraction', () => {
    const { container } = render(<PixelWaveform peaks={PEAKS} progress={0.25} />);
    const clipRect = container.querySelector('clipPath rect');
    expect(clipRect).toHaveAttribute('width', '80'); // 320 * 0.25
  });

  it('positions the playhead at the progress fraction', () => {
    render(<PixelWaveform peaks={PEAKS} progress={0.4} />);
    expect(screen.getByTestId('playhead')).toHaveStyle({ left: '40%' });
  });

  it('clamps out-of-range progress', () => {
    const { rerender } = render(<PixelWaveform peaks={PEAKS} progress={5} />);
    expect(screen.getByTestId('playhead')).toHaveStyle({ left: '100%' });
    rerender(<PixelWaveform peaks={PEAKS} progress={-2} />);
    expect(screen.getByTestId('playhead')).toHaveStyle({ left: '0%' });
  });

  it('renders no bars and no playhead without peaks', () => {
    const { container } = render(<PixelWaveform peaks={[]} progress={0} />);
    expect(container.querySelectorAll('svg > g')).toHaveLength(0);
    expect(screen.queryByTestId('playhead')).not.toBeInTheDocument();
    expect(screen.getByTestId('waveform')).toHaveClass('vx-wave--empty');
  });

  it('reports a seek fraction from the click position', () => {
    const onSeek = vi.fn();
    render(<PixelWaveform peaks={PEAKS} progress={0} onSeek={onSeek} />);
    const wave = screen.getByTestId('waveform');
    vi.spyOn(wave, 'getBoundingClientRect').mockReturnValue({
      left: 100, width: 200, top: 0, height: 40, right: 300, bottom: 40, x: 100, y: 0,
      toJSON: () => ({}),
    });
    fireEvent.click(wave, { clientX: 150 });
    expect(onSeek).toHaveBeenCalledWith(0.25);
  });

  it('does not seek when there are no peaks', () => {
    const onSeek = vi.fn();
    render(<PixelWaveform peaks={[]} progress={0} onSeek={onSeek} />);
    fireEvent.click(screen.getByTestId('waveform'), { clientX: 50 });
    expect(onSeek).not.toHaveBeenCalled();
  });

  it('tints the played gradient with the accent colour', () => {
    const { container } = render(
      <PixelWaveform peaks={PEAKS} progress={0.5} accentColor="#6fe3a1" />,
    );
    const stops = [...container.querySelectorAll('linearGradient')]
      .flatMap((g) => [...g.querySelectorAll('stop')])
      .map((s) => s.getAttribute('stop-color'));
    expect(stops).toContain('#6fe3a1');
  });
});
