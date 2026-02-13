// app/src/components/__tests__/ListingWizard.test.tsx
import { render, screen } from '@testing-library/react';
import { ListingWizard } from '../ListingWizard';
import { describe, it, expect, vi } from 'vitest';

// Mock Convex hooks
vi.mock('convex/react', () => ({
  useQuery: () => [],
  useMutation: () => vi.fn(),
}));

describe('ListingWizard', () => {
  it('renders the first step by default', () => {
    render(<ListingWizard />);
    
    expect(screen.getAllByText(/General Information/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Step 1 of 5/i)).toBeInTheDocument();
  });
});
