// app/src/components/__tests__/BidForm.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { BidForm } from '../BidForm';
import { describe, it, expect, vi } from 'vitest';
import type { Doc, Id } from '../../../convex/_generated/dataModel';

describe('BidForm', () => {
  const mockAuction = {
    _id: 'auction123' as Id<"auctions">,
    currentPrice: 50000,
    minIncrement: 500,
    endTime: Date.now() + 100000,
    status: 'active',
  } as Doc<"auctions">;

  it('validates manual bid input correctly', () => {
    render(<BidForm auction={mockAuction} onBid={vi.fn()} isLoading={false} />);
    
    const input = screen.getByPlaceholderText('Enter amount');
    const submitButton = screen.getByRole('button', { name: /Place Bid/i });

    // Try a bid lower than minimum
    fireEvent.change(input, { target: { value: '50499' } });
    expect(submitButton).toBeDisabled();

    // Try a valid bid
    fireEvent.change(input, { target: { value: '50500' } });
    expect(submitButton).not.toBeDisabled();
  });

  it('renders quick bid buttons with correct amounts', () => {
    render(<BidForm auction={mockAuction} onBid={vi.fn()} isLoading={false} />);
    
    expect(screen.getByText('R50,500')).toBeInTheDocument();
    expect(screen.getByText('R51,000')).toBeInTheDocument();
    expect(screen.getByText('R53,000')).toBeInTheDocument();
  });
});
