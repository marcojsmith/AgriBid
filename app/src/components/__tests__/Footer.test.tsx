import { render, screen } from '@testing-library/react';
import { Footer } from '../Footer';
import { describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

describe('Footer', () => {
  const renderFooter = () => render(
    <BrowserRouter>
      <Footer />
    </BrowserRouter>
  );

  it('renders the brand name and copyright', () => {
    renderFooter();
    expect(screen.getAllByText(/AGRIBID/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/All rights reserved/i)).toBeInTheDocument();
  });

  it('contains the mission statement', () => {
    renderFooter();
    expect(screen.getByText(/built for farmers/i)).toBeInTheDocument();
  });

  it('renders all required navigation sections and links', () => {
    renderFooter();
    expect(screen.getByText(/How it Works/i)).toBeInTheDocument();
    expect(screen.getByText(/Safety & Trust/i)).toBeInTheDocument();
    expect(screen.getByText(/Terms of Service/i)).toBeInTheDocument();
    expect(screen.getByText(/Help Center/i)).toBeInTheDocument();
  });
});
