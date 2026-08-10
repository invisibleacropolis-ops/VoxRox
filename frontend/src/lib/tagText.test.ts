import { describe, expect, it } from 'vitest';
import { insertAt, strip } from './tagText';

describe('strip', () => {
  it('removes tags and collapses whitespace', () => {
    expect(strip('Hey [laughter] there')).toBe('Hey there');
  });
  it('leaves plain text alone', () => {
    expect(strip('Hey there')).toBe('Hey there');
  });
  it('returns an empty string for tag-only text', () => {
    expect(strip('[sigh]')).toBe('');
  });
});

describe('insertAt', () => {
  it('inserts at the caret with a trailing space', () => {
    expect(insertAt('', 0, '[sigh]')).toEqual({ text: '[sigh] ', caret: 7 });
  });

  it('adds a leading space when the caret follows a word', () => {
    expect(insertAt('Hello', 5, '[sigh]')).toEqual({
      text: 'Hello [sigh] ',
      caret: 13,
    });
  });

  it('does not double the space when one already precedes the caret', () => {
    expect(insertAt('Hello ', 6, '[sigh]')).toEqual({
      text: 'Hello [sigh] ',
      caret: 13,
    });
  });

  it('splices into the middle of existing text', () => {
    const result = insertAt('ab cd', 2, '[sigh]');
    expect(result.text).toBe('ab [sigh]  cd');
  });

  it('clamps an out-of-range caret to the end', () => {
    expect(insertAt('ab', 99, '[sigh]').text).toBe('ab [sigh] ');
  });
});
