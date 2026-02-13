// app/src/components/__tests__/ListingWizard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ListingWizard } from '../ListingWizard';
import { describe, it, expect, vi } from 'vitest';

// Mock Convex hooks
vi.mock('convex/react', () => ({
  useQuery: () => [
    { make: 'John Deere', models: ['6155R', '8R 410'], category: 'Tractor' },
    { make: 'Case IH', models: ['Magnum 340'], category: 'Tractor' },
  ],
  useMutation: () => vi.fn().mockReturnValue(vi.fn()),
}));

describe('ListingWizard', () => {
  it('renders the first step by default', () => {
    render(<ListingWizard />);
    
    expect(screen.getAllByText(/General Information/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Step 1 of 5/i)).toBeInTheDocument();
  });

  it('prevents navigation if first step is invalid', () => {
    render(<ListingWizard />);
    
    const nextButton = screen.getByText(/Next Step/i);
    fireEvent.click(nextButton);
    
    // Should still be on Step 1 because fields are empty
    expect(screen.getByText(/Step 1 of 5/i)).toBeInTheDocument();
  });

  it('navigates to step 2 when fields are filled', () => {
    render(<ListingWizard />);
    
    // Fill required fields for Step 0
    fireEvent.change(screen.getByPlaceholder(`e.g. 2023`), { target: { value: '2024' } });
    fireEvent.change(screen.getByPlaceholder('e.g. PE11 2AA'), { target: { value: 'NG1 1AA' } });
    fireEvent.change(screen.getByPlaceholder(/e.g. 2023 John Deere/), { target: { value: 'Test Auction Title' } });
    
    const nextButton = screen.getByText(/Next Step/i);
    fireEvent.click(nextButton);
    
    expect(screen.getByText(/Step 2 of 5/i)).toBeInTheDocument();
    expect(screen.getByText(/Technical Specifications/i)).toBeInTheDocument();
  });

  it('allows selecting a manufacturer in step 2', () => {
    render(<ListingWizard />);
    
    // Fill Step 0
    fireEvent.change(screen.getByPlaceholder(`e.g. 2023`), { target: { value: '2024' } });
    fireEvent.change(screen.getByPlaceholder('e.g. PE11 2AA'), { target: { value: 'NG1 1AA' } });
    fireEvent.change(screen.getByPlaceholder(/e.g. 2023 John Deere/), { target: { value: 'Test Auction Title' } });
    fireEvent.click(screen.getByText(/Next Step/i));

    // Step 1: Select Make
    const jdButton = screen.getByText('John Deere');
    fireEvent.click(jdButton);
    
    // Models should now appear
    expect(screen.getByText('6155R')).toBeInTheDocument();
    expect(screen.getByText('8R 410')).toBeInTheDocument();
  });
});
