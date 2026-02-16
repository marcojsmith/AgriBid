import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '../Header';
import { BiddingPanel } from '../BiddingPanel';
import { AuctionCard } from '../AuctionCard';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import * as authClient from '../../lib/auth-client';
import * as React from 'react';
import type { Doc, Id } from 'convex/_generated/dataModel';

const mockNavigate = vi.fn();

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/auction/123', search: '', hash: '' }),
  };
});

// Mock Convex
vi.mock('convex/react', () => ({
  Authenticated: ({ children }: { children: React.ReactNode }) => <div data-testid="auth">{children}</div>,
  Unauthenticated: ({ children }: { children: React.ReactNode }) => <div data-testid="unauth">{children}</div>,
  useMutation: () => vi.fn(),
  useQuery: (apiFunc: any) => {
    const path = typeof apiFunc === 'string' ? apiFunc : apiFunc?._path;
    const pathStr = typeof path === 'string' ? path : "";
    if (pathStr.includes("isWatched")) return false;
    return [];
  },
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
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );
  };

  it('shows Sell link for guests', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as any);
    renderHeader();
    
    // Desktop nav
    const desktopNav = screen.getByRole('navigation', { name: /main navigation/i }); 
    expect(desktopNav).toHaveTextContent(/Sell/i);
  });

  it('hides Admin link from guests', () => {
     // eslint-disable-next-line @typescript-eslint/no-explicit-any
     vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as any);
     renderHeader();
     expect(screen.queryByText(/Admin/i)).not.toBeInTheDocument();
  });

  it('redirects to /login with callbackUrl when bidding as guest', () => {
    const mockAuction = {
      _id: 'auction123' as Id<"auctions">,
      currentPrice: 50000,
      minIncrement: 500,
      endTime: Date.now() + 100000,
      status: 'active',
      images: { additional: [] }
    } as unknown as Doc<"auctions">;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as any);

    render(
      <MemoryRouter initialEntries={['/auction/123']}>
        <BiddingPanel auction={mockAuction} />
      </MemoryRouter>
    );

    const bidButton = screen.getByRole('button', { name: /Place Bid/i });
    fireEvent.click(bidButton);

    expect(mockNavigate).toHaveBeenCalledWith('/login?callbackUrl=%2Fauction%2F123');
  });

  it('AuctionCard redirects to specific auction detail page when bidding as guest', () => {
    const mockAuction = {
      _id: 'auction456' as Id<"auctions">,
      currentPrice: 100000,
      minIncrement: 1000,
      endTime: Date.now() + 100000,
      status: 'active',
      images: { additional: [] },
      title: 'Tractor',
      year: 2024,
      make: 'JD',
      location: 'Local',
      operatingHours: 100
    } as unknown as Doc<"auctions">;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as any);

    render(
      <MemoryRouter>
        <AuctionCard auction={mockAuction} />
      </MemoryRouter>
    );

    const bidButton = screen.getByRole('button', { name: /Bid R101[,\s\u00a0]000/i });
    fireEvent.click(bidButton);

    expect(mockNavigate).toHaveBeenCalledWith('/login?callbackUrl=%2Fauction%2Fauction456');
  });
});
