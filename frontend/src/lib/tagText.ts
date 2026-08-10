const TAG_PATTERN = /\[[a-z0-9]+(?:-[a-z0-9]+)*\]/g;

/** Text with non-verbal tags removed, for compact previews. */
export function strip(text: string): string {
  return text.replace(TAG_PATTERN, '').replace(/\s{2,}/g, ' ').trim();
}

/** Insert `token` at `position`, returning the new text and caret offset. */
export function insertAt(
  text: string,
  position: number,
  token: string,
): { text: string; caret: number } {
  const safe = Math.max(0, Math.min(position, text.length));
  const needsLeadingSpace = safe > 0 && !/\s$/.test(text.slice(0, safe));
  const insertion = `${needsLeadingSpace ? ' ' : ''}${token} `;
  return {
    text: `${text.slice(0, safe)}${insertion}${text.slice(safe)}`,
    caret: safe + insertion.length,
  };
}
