import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the four main menu entries', () => {
    render(<App />);
    for (const label of ['Profiles', 'Chat', 'Script', 'Settings']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
  });

  it('opens on the Profiles screen', () => {
    render(<App />);
    expect(screen.getByRole('tab', { name: 'Profiles' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
