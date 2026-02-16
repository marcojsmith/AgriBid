// app/src/components/__tests__/AuctionHeader.test.tsx
import { render, screen } from '@testing-library/react';
import { AuctionHeader } from '../AuctionHeader';
import { describe, it, expect, vi } from 'vitest';
import type { Doc, Id } from 'convex/_generated/dataModel';
import { MemoryRouter } from 'react-router-dom';

// Mock Convex
vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: () => vi.fn(),
}));

// Mock auth client
vi.mock('../../lib/auth-client', () => ({
  useSession: () => ({ data: null, isPending: false }),
}));

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
    render(
      <MemoryRouter>
        <AuctionHeader auction={mockAuction} />
      </MemoryRouter>
    );
    
    expect(screen.getByText('John Deere 8RX 410')).toBeInTheDocument();
    expect(screen.getByText('2022 John Deere')).toBeInTheDocument();
    expect(screen.getByText('Iowa, USA')).toBeInTheDocument();
    expect(screen.getByText(/1\s*[.,]?\s*200\s*Operating Hours/)).toBeInTheDocument();
    expect(screen.getByText('Year 2022')).toBeInTheDocument();
  });
});
