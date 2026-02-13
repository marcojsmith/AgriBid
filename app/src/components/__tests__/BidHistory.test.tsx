// app/src/components/__tests__/BidHistory.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { BidHistory } from '../BidHistory';
import { describe, it, expect, vi } from 'vitest';

// Mock Convex hooks
vi.mock('convex/react', () => ({
  useQuery: () => [
    { _id: 'bid1', amount: 50000, bidderName: 'John Doe', timestamp: Date.now() - 10000 },
    { _id: 'bid2', amount: 51000, bidderName: 'Jane Smith', timestamp: Date.now() - 5000 },
  ],
}));

describe('BidHistory', () => {
  it('renders correctly and toggles expansion', () => {
    render(<BidHistory auctionId={"auction123" as any} />);
    
    // Header should be visible
    expect(screen.getByText(/Bid History/i)).toBeInTheDocument();
    
    // Initially content should be hidden (using accordion/collapsible logic)
    // We'll check if the bids are visible after clicking the trigger
    const trigger = screen.getByRole('button', { name: /Bid History/i });
    fireEvent.click(trigger);
    
    // Check for anonymized names (e.g. J*** D**)
    expect(screen.getByText(/J\*\*\* D\*\*/)).toBeInTheDocument();
    expect(screen.getByText(/R51,000/)).toBeInTheDocument();
  });
});
