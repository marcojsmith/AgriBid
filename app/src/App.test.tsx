import { render, screen } from '@testing-library/react';
import App from './App';
import { describe, it, expect, vi } from 'vitest';

// Mock the pages to avoid Convex dependencies in this unit test
vi.mock('./pages/Home', () => ({ default: () => <div data-testid="home-page">Home Page</div> }));
vi.mock('./pages/AuctionDetail', () => ({ default: () => <div data-testid="detail-page">Detail Page</div> }));
vi.mock('./pages/Sell', () => ({ default: () => <div data-testid="sell-page">Sell Page</div> }));

// Mock Convex and Auth globally for App tests
vi.mock('convex/react', () => ({
  Authenticated: ({ children }: { children: React.ReactNode }) => <div data-testid="auth">{children}</div>,
  Unauthenticated: ({ children }: { children: React.ReactNode }) => <div data-testid="unauth">{children}</div>,
}));

vi.mock('./lib/auth-client', () => ({
  useSession: () => ({ data: null, isPending: false }),
  signOut: vi.fn(),
}));

describe('App', () => {
  it('renders within the Layout (contains AGRIBID header)', () => {
    render(<App />);
    // The Header and Footer placeholders both contain "AGRIBID"
    expect(screen.getAllByText(/AGRIBID/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId('home-page')).toBeInTheDocument();
  });
});
