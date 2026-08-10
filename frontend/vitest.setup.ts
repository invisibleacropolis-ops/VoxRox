import '@testing-library/jest-dom/vitest';

// jsdom implements neither of these; the sequencer and window animations need them.
if (!window.HTMLMediaElement.prototype.play) {
  window.HTMLMediaElement.prototype.play = async () => {};
}
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
