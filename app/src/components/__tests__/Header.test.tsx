import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '../Header';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

// Mock Convex and Auth
vi.mock('convex/react', () => ({
  Authenticated: ({ children }: { children: React.ReactNode }) => <div data-testid="auth">{children}</div>,
  Unauthenticated: ({ children }: { children: React.ReactNode }) => <div data-testid="unauth">{children}</div>,
}));

vi.mock('../../lib/auth-client', () => ({
  useSession: () => ({ data: null }),
  signOut: vi.fn(),
}));

describe('Header', () => {
  it('renders the brand name', () => {
    render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    );
    expect(screen.getByText(/AGRIBID/i)).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    );
    expect(screen.getByText(/Marketplace/i)).toBeInTheDocument();
    expect(screen.getByText(/Sell/i)).toBeInTheDocument();
    expect(screen.getByText(/Watchlist/i)).toBeInTheDocument();
  });

  it('toggles mobile menu when clicked', () => {
    render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    );
    
    // Find menu toggle button (hamburger)
    const toggle = screen.getByLabelText(/Toggle menu/i);
    expect(toggle).toBeInTheDocument();

    // Click to open
    fireEvent.click(toggle);
    
    // Check if mobile nav links are visible (they have different classes but same text)
    const links = screen.getAllByText(/Marketplace/i);
    expect(links.length).toBeGreaterThan(1); // One in desktop nav, one in mobile nav
  });
});
