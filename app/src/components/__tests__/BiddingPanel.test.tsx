// app/src/components/__tests__/BiddingPanel.test.tsx
import { render, screen } from '@testing-library/react';
import { BiddingPanel } from '../BiddingPanel';
import { describe, it, expect, vi } from 'vitest';
import type { Doc, Id } from '../../../convex/_generated/dataModel';

// Mock the CountdownTimer since it has its own tests
vi.mock('../CountdownTimer', () => ({
  CountdownTimer: ({ endTime }: { endTime: number }) => <div data-testid="mock-timer">{endTime}</div>,
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
    render(<BiddingPanel auction={mockAuction} />);
    
    expect(screen.getByText((content) => content.includes('R50,000'))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('Next minimum bid'))).toBeInTheDocument();
    // Use getAllByText because the next min bid appears in both the info text and the quick bid button
    expect(screen.getAllByText('R50,500').length).toBeGreaterThanOrEqual(1);
  });

  it('shows ended state when auction is not active', () => {
    const endedAuction = { ...mockAuction, status: 'sold' } as Doc<"auctions">;
    render(<BiddingPanel auction={endedAuction} />);
    
    expect(screen.getByText(/Auction Ended/i)).toBeInTheDocument();
  });
});
