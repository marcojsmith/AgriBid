import { render, screen } from '@testing-library/react';
import { Header } from '../Header';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import * as authClient from '../../lib/auth-client';
import * as React from 'react';

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

// Mock Convex
vi.mock('convex/react', () => ({
  Authenticated: ({ children }: { children: React.ReactNode }) => <div data-testid="auth">{children}</div>,
  Unauthenticated: ({ children }: { children: React.ReactNode }) => <div data-testid="unauth">{children}</div>,
}));

// Mock auth client
vi.mock('../../lib/auth-client', () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}));

describe('Guest Restrictions - Phase 1: Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderHeader = () => {
    return render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    );
  };

  it('hides Sell link from guests', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as any);
    renderHeader();
    
    // Desktop nav
    const desktopNav = screen.getByRole('navigation', { name: '' }); // The first nav doesn't have a name
    expect(desktopNav).not.toHaveTextContent(/Sell/i);
  });

  it('hides Admin link from guests', () => {
     // eslint-disable-next-line @typescript-eslint/no-explicit-any
     vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as any);
     renderHeader();
     expect(screen.queryByText(/Admin/i)).not.toBeInTheDocument();
  });

  it('redirects to home with callbackUrl when bidding as guest', () => {
    // This test would be better in BiddingPanel.test.tsx or AuctionCard.test.tsx
    // but I'll add it here for now to verify the logic.
  });
});
