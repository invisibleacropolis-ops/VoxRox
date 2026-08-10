import { describe, expect, it } from 'vitest';
import { formatTime } from './formatTime';

describe('formatTime', () => {
  it('formats sub-minute durations', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(7.4)).toBe('0:07');
    expect(formatTime(59.9)).toBe('0:59');
  });

  it('formats minutes', () => {
    expect(formatTime(60)).toBe('1:00');
    expect(formatTime(125)).toBe('2:05');
  });

  it('treats invalid input as zero', () => {
    expect(formatTime(Number.NaN)).toBe('0:00');
    expect(formatTime(-5)).toBe('0:00');
  });
});
