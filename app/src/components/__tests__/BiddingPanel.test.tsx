// app/src/components/__tests__/BiddingPanel.test.tsx
import { render, screen } from '@testing-library/react';
import { BiddingPanel } from '../BiddingPanel';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import type { Doc, Id } from 'convex/_generated/dataModel';

// Mock the CountdownTimer since it has its own tests
vi.mock('../CountdownTimer', () => ({
  CountdownTimer: ({ endTime }: { endTime: number }) => <div data-testid="mock-timer">{endTime}</div>,
}));

// Mock auth client
vi.mock('../../lib/auth-client', () => ({
  useSession: vi.fn(() => ({ data: { user: { name: 'Test User' } }, isPending: false })),
}));

// Mock Convex hooks
vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  useQuery: () => null,
}));

describe('BiddingPanel', () => {
  const mockAuction = {
    _id: 'auction123' as Id<"auctions">,
    currentPrice: 50000,
    minIncrement: 500,
    endTime: Date.now() + 100000,
    status: 'active',
  } as Doc<"auctions">;

  it('renders current price and minimum bid correctly', () => {
    render(
      <BrowserRouter>
        <BiddingPanel auction={mockAuction} />
      </BrowserRouter>
    );
    
    // Check for R and the price digits, allowing for different grouping symbols (space or comma)
    expect(screen.getByText(/R.*50.000/)).toBeInTheDocument();
    expect(screen.getByText(/Next minimum bid/i)).toBeInTheDocument();
    // Check for R and the next bid digits
    expect(screen.getAllByText(/R.*50.500/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows ended state when auction is not active', () => {
    const endedAuction = { ...mockAuction, status: 'sold' } as Doc<"auctions">;
    render(
      <BrowserRouter>
        <BiddingPanel auction={endedAuction} />
      </BrowserRouter>
    );
    
    expect(screen.getByText(/Auction SOLD/i)).toBeInTheDocument();
  });
});
