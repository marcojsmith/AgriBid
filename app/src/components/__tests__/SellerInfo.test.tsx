// app/src/components/__tests__/SellerInfo.test.tsx
import { render, screen } from '@testing-library/react';
import { SellerInfo } from '../SellerInfo';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// Mock Convex hooks
vi.mock('convex/react', () => ({
  useQuery: () => ({
    name: 'Verified Farmer',
    isVerified: true,
    role: 'Commercial Dealer',
    createdAt: Date.now() - 31536000000, // 1 year ago
  }),
}));

describe('SellerInfo', () => {
  it('renders seller details correctly', () => {
    render(
      <MemoryRouter>
        <SellerInfo sellerId="seller123" />
      </MemoryRouter>
    );
    
    expect(screen.getByText('Verified Farmer')).toBeInTheDocument();
    expect(screen.getByText('Commercial Dealer')).toBeInTheDocument();
    expect(screen.getByText(/High-Integrity Verification/i)).toBeInTheDocument();
  });
});
