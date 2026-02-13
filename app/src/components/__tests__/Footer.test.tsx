import { render, screen } from '@testing-library/react';
import { Footer } from '../Footer';
import { describe, it, expect } from 'vitest';

describe('Footer', () => {
  it('renders the brand name and copyright', () => {
    render(<Footer />);
    expect(screen.getAllByText(/AGRIBID/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/All rights reserved/i)).toBeInTheDocument();
  });

  it('contains the mission statement', () => {
    render(<Footer />);
    expect(screen.getByText(/built for farmers/i)).toBeInTheDocument();
  });
});
