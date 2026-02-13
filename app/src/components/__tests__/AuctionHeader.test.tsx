// app/src/components/__tests__/AuctionHeader.test.tsx
import { render, screen } from '@testing-library/react';
import { AuctionHeader } from '../AuctionHeader';
import { describe, it, expect } from 'vitest';
import type { Doc, Id } from '../../../convex/_generated/dataModel';

describe('AuctionHeader', () => {
  const mockAuction = {
    _id: 'auction123' as Id<"auctions">,
    title: 'John Deere 8RX 410',
    make: 'John Deere',
    model: '8RX 410',
    year: 2022,
    location: 'Iowa, USA',
    operatingHours: 1200,
  } as Doc<"auctions">;

  it('renders auction details correctly', () => {
    render(<AuctionHeader auction={mockAuction} />);
    
    expect(screen.getByText('John Deere 8RX 410')).toBeInTheDocument();
    expect(screen.getByText('2022 John Deere')).toBeInTheDocument();
    expect(screen.getByText('Iowa, USA')).toBeInTheDocument();
    expect(screen.getByText('1,200 Operating Hours')).toBeInTheDocument();
    expect(screen.getByText('Year 2022')).toBeInTheDocument();
  });
});
