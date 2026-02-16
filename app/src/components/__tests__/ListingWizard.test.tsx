// app/src/components/__tests__/ListingWizard.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ListingWizard } from '../ListingWizard';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

// Mock Convex hooks
vi.mock('convex/react', () => ({
  useQuery: () => [
    { make: 'John Deere', models: ['6155R', '8R 410'], category: 'Tractor' },
    { make: 'Case IH', models: ['Magnum 340'], category: 'Tractor' },
  ],
  useMutation: (apiFunc: unknown) => {
    const func = apiFunc as { _path?: string } | string;
    const path = typeof func === 'string' ? func : func?._path || "";
    const isUpload = typeof path === 'string' && path.includes('generateUploadUrl');
    
    if (isUpload) {
      return vi.fn().mockResolvedValue('http://upload.url');
    }
    return vi.fn().mockResolvedValue({});
  },
}));

// Mock auth client
vi.mock('../../lib/auth-client', () => ({
  useSession: vi.fn(() => ({ data: { user: { name: 'Test Seller' } }, isPending: false })),
}));

// Mock browser APIs
const originalFetch = global.fetch;

describe('ListingWizard', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ storageId: 'test-storage-id' }),
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  const renderWizard = () => render(
    <BrowserRouter>
      <ListingWizard />
    </BrowserRouter>
  );

  const navigateToStep4 = () => {
    fireEvent.change(screen.getByLabelText(/Manufacturing Year/i), { target: { value: '2024' } });
    fireEvent.change(screen.getByLabelText(/Location/i), { target: { value: 'Pretoria, ZA' } });
    fireEvent.change(screen.getByLabelText(/Listing Title/i), { target: { value: 'Test Auction Title' } });
    fireEvent.click(screen.getByText(/Next Step/i));
    
    fireEvent.click(screen.getByText('John Deere'));
    fireEvent.click(screen.getByText('6155R'));
    fireEvent.click(screen.getByText(/Next Step/i));
    
    const yesButtons = screen.getAllByText('Yes');
    yesButtons.forEach(btn => {
      fireEvent.click(btn);
    });
    fireEvent.click(screen.getByText(/Next Step/i));
  };

  it('renders the first step by default', () => {
    renderWizard();
    
    expect(screen.getAllByText(/General Information/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Step 1 of 6/i)).toBeInTheDocument();
  });

  it('navigates to step 2 when fields are filled', () => {
    renderWizard();
    
    fireEvent.change(screen.getByLabelText(/Manufacturing Year/i), { target: { value: '2024' } });
    fireEvent.change(screen.getByLabelText(/Location/i), { target: { value: 'Pretoria, ZA' } });
    fireEvent.change(screen.getByLabelText(/Listing Title/i), { target: { value: 'Test Auction Title' } });
    
    fireEvent.click(screen.getByText(/Next Step/i));
    
    expect(screen.getByText(/Step 2 of 6/i)).toBeInTheDocument();
    expect(screen.getByText(/Technical Specifications/i)).toBeInTheDocument();
  });

  it('requires all condition checklist items to be filled', () => {
    renderWizard();
    
    // Fill Step 1
    fireEvent.change(screen.getByLabelText(/Manufacturing Year/i), { target: { value: '2024' } });
    fireEvent.change(screen.getByLabelText(/Location/i), { target: { value: 'Pretoria, ZA' } });
    fireEvent.change(screen.getByLabelText(/Listing Title/i), { target: { value: 'Test Auction Title' } });
    fireEvent.click(screen.getByText(/Next Step/i));

    // Fill Step 2 (Manufacturer/Model)
    fireEvent.click(screen.getByText('John Deere'));
    fireEvent.click(screen.getByText('6155R'));
    fireEvent.click(screen.getByText(/Next Step/i));

    expect(screen.getByText(/Condition Checklist/i)).toBeInTheDocument();

    // Fill all Yes buttons
    const yesButtons = screen.getAllByText('Yes');
    yesButtons.forEach(btn => {
      fireEvent.click(btn);
    });
    
    fireEvent.click(screen.getByText(/Next Step/i));
    expect(screen.getByText(/Step 4 of 6/i)).toBeInTheDocument();
    expect(screen.getByText(/Media Gallery/i)).toBeInTheDocument();
  });

  it('validates required image slots', async () => {
    renderWizard();
    
    navigateToStep4();

    expect(screen.getByText(/Media Gallery/i)).toBeInTheDocument();

    // Try to proceed without images
    fireEvent.click(screen.getByText(/Next Step/i));
    expect(screen.getByText(/Step 4 of 6/i)).toBeInTheDocument();

    // Mock file upload for a non-front slot (e.g., Engine Bay)
    const file = new File(['(⌐□_□)'], 'engine.png', { type: 'image/png' });
    const input = screen.getByLabelText(/Engine Bay/i);
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/ENGINE BAY \(UPLOADED\)/i)).toBeInTheDocument();
    });

    // Should now proceed as at least one image is uploaded
    fireEvent.click(screen.getByText(/Next Step/i));
    expect(screen.getByText(/Step 5 of 6/i)).toBeInTheDocument();
    expect(screen.getByText(/Pricing & Duration/i)).toBeInTheDocument();
  });
});
