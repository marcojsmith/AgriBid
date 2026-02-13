import { render, screen } from '@testing-library/react';
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
});
