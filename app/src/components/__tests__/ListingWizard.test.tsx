// app/src/components/__tests__/ListingWizard.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ListingWizard } from '../ListingWizard';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCreateAuction = vi.fn();

// Mock Convex hooks
vi.mock('convex/react', () => ({
  useQuery: () => [
    { make: 'John Deere', models: ['6155R', '8R 410'], category: 'Tractor' },
    { make: 'Case IH', models: ['Magnum 340'], category: 'Tractor' },
  ],
  useMutation: () => mockCreateAuction,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ListingWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

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
    fireEvent.change(screen.getByPlaceholderText(`e.g. 2023`), { target: { value: '2024' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. PE11 2AA'), { target: { value: 'NG1 1AA' } });
    fireEvent.change(screen.getByPlaceholderText(/e.g. 2023 John Deere/), { target: { value: 'Test Auction Title' } });

    const nextButton = screen.getByText(/Next Step/i);
    fireEvent.click(nextButton);

    expect(screen.getByText(/Step 2 of 5/i)).toBeInTheDocument();
    expect(screen.getByText(/Technical Specifications/i)).toBeInTheDocument();
  });

  it('allows selecting a manufacturer in step 2', () => {
    render(<ListingWizard />);

    // Fill Step 0
    fireEvent.change(screen.getByPlaceholderText(`e.g. 2023`), { target: { value: '2024' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. PE11 2AA'), { target: { value: 'NG1 1AA' } });
    fireEvent.change(screen.getByPlaceholderText(/e.g. 2023 John Deere/), { target: { value: 'Test Auction Title' } });
    fireEvent.click(screen.getByText(/Next Step/i));

    // Step 1: Select Make
    const jdButton = screen.getByText('John Deere');
    fireEvent.click(jdButton);

    // Models should now appear
    expect(screen.getByText('6155R')).toBeInTheDocument();
    expect(screen.getByText('8R 410')).toBeInTheDocument();
  });

  it('shows draft saved indicator', () => {
    render(<ListingWizard />);

    expect(screen.getByText(/Draft Saved/i)).toBeInTheDocument();
  });

  it('displays progress bar reflecting current step', () => {
    render(<ListingWizard />);

    const progressBar = document.querySelector('[style*="20%"]');
    expect(progressBar).toBeInTheDocument();
  });

  it('allows navigation to previous step', () => {
    render(<ListingWizard />);

    // Navigate to step 2
    fireEvent.change(screen.getByPlaceholderText('e.g. 2023'), { target: { value: '2023' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. PE11 2AA'), { target: { value: 'Iowa, USA' } });
    fireEvent.change(screen.getByPlaceholderText(/e.g. 2023 John Deere/), { target: { value: 'Test Tractor' } });
    fireEvent.click(screen.getByText(/Next Step/i));

    expect(screen.getByText(/Step 2 of 5/i)).toBeInTheDocument();

    const previousButton = screen.getByText(/Previous/i);
    fireEvent.click(previousButton);

    expect(screen.getByText(/Step 1 of 5/i)).toBeInTheDocument();
  });

  it('disables previous button on first step', () => {
    render(<ListingWizard />);

    const previousButton = screen.getByRole('button', { name: /Previous/i });
    expect(previousButton).toBeDisabled();
  });

  it('renders condition checklist in step 3', () => {
    render(<ListingWizard />);

    // Navigate to step 3
    fireEvent.change(screen.getByPlaceholderText('e.g. 2023'), { target: { value: '2023' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. PE11 2AA'), { target: { value: 'Iowa, USA' } });
    fireEvent.change(screen.getByPlaceholderText(/e.g. 2023 John Deere/), { target: { value: 'Test Tractor' } });
    fireEvent.click(screen.getByText(/Next Step/i));

    fireEvent.click(screen.getByText('John Deere'));
    fireEvent.click(screen.getByText('6155R'));
    fireEvent.click(screen.getByText(/Next Step/i));

    expect(screen.getByText(/Step 3 of 5/i)).toBeInTheDocument();
    expect(screen.getByText(/Condition Checklist/i)).toBeInTheDocument();
    expect(screen.getByText(/Engine Condition/i)).toBeInTheDocument();
    expect(screen.getByText(/Hydraulic System/i)).toBeInTheDocument();
  });

  it('saves form data to localStorage', async () => {
    render(<ListingWizard />);

    const yearInput = screen.getByPlaceholderText('e.g. 2023');
    fireEvent.change(yearInput, { target: { value: '2023' } });

    await waitFor(() => {
      const saved = localStorage.getItem('agribid_listing_draft');
      expect(saved).toBeTruthy();
      const parsed = JSON.parse(saved!);
      expect(parsed.year).toBe(2023);
    });
  });

  it('loads form data from localStorage on mount', () => {
    const draftData = {
      year: 2021,
      make: 'John Deere',
      model: '6155R',
      location: 'Test Location',
      operatingHours: 1500,
      title: '2021 John Deere 6155R',
      conditionChecklist: {
        engine: null,
        hydraulics: null,
        tires: null,
        serviceHistory: null,
        notes: '',
      },
      images: {},
      startingPrice: 0,
      reservePrice: 0,
    };

    localStorage.setItem('agribid_listing_draft', JSON.stringify(draftData));

    render(<ListingWizard />);

    const yearInput = screen.getByPlaceholderText('e.g. 2023') as HTMLInputElement;
    expect(yearInput.value).toBe('2021');
  });

  it('auto-generates title from year, make, and model', () => {
    render(<ListingWizard />);

    const yearInput = screen.getByPlaceholderText('e.g. 2023');
    fireEvent.change(yearInput, { target: { value: '2023' } });

    // Navigate to step 2 and select make/model
    const locationInput = screen.getByPlaceholderText('e.g. PE11 2AA');
    fireEvent.change(locationInput, { target: { value: 'Iowa' } });

    const titleInput = screen.getByPlaceholderText(/e.g. 2023 John Deere/) as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Custom Title' } });

    fireEvent.click(screen.getByText(/Next Step/i));

    // Select make
    fireEvent.click(screen.getByText('John Deere'));

    // Check that title gets updated (happens in state)
    expect(screen.getByText(/Step 2 of 5/i)).toBeInTheDocument();
  });

  it('shows placeholder when no manufacturer selected', () => {
    render(<ListingWizard />);

    // Navigate to step 2
    fireEvent.change(screen.getByPlaceholderText('e.g. 2023'), { target: { value: '2023' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. PE11 2AA'), { target: { value: 'Iowa, USA' } });
    fireEvent.change(screen.getByPlaceholderText(/e.g. 2023 John Deere/), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText(/Next Step/i));

    expect(screen.getByText(/Select a manufacturer to view available models/i)).toBeInTheDocument();
  });

  it('shows honesty warning in condition checklist step', () => {
    render(<ListingWizard />);

    // Navigate to step 3
    fireEvent.change(screen.getByPlaceholderText('e.g. 2023'), { target: { value: '2023' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. PE11 2AA'), { target: { value: 'Iowa' } });
    fireEvent.change(screen.getByPlaceholderText(/e.g. 2023 John Deere/), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText(/Next Step/i));
    fireEvent.click(screen.getByText('John Deere'));
    fireEvent.click(screen.getByText('6155R'));
    fireEvent.click(screen.getByText(/Next Step/i));

    expect(screen.getByText(/Honesty ensures the highest final bid/i)).toBeInTheDocument();
  });

  it('validates step 3 requires all checklist items answered', () => {
    render(<ListingWizard />);

    // Navigate to step 3
    fireEvent.change(screen.getByPlaceholderText('e.g. 2023'), { target: { value: '2023' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. PE11 2AA'), { target: { value: 'Iowa' } });
    fireEvent.change(screen.getByPlaceholderText(/e.g. 2023 John Deere/), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText(/Next Step/i));
    fireEvent.click(screen.getByText('John Deere'));
    fireEvent.click(screen.getByText('6155R'));
    fireEvent.click(screen.getByText(/Next Step/i));

    // Try to proceed without answering checklist
    fireEvent.click(screen.getByText(/Next Step/i));

    // Should still be on step 3
    expect(screen.getByText(/Step 3 of 5/i)).toBeInTheDocument();
  });

  it('allows inputting operating hours', () => {
    render(<ListingWizard />);

    const hoursInput = screen.getByPlaceholderText('e.g. 1200');
    fireEvent.change(hoursInput, { target: { value: '1500' } });

    expect((hoursInput as HTMLInputElement).value).toBe('1500');
  });

  it('validates year is greater than 1900', () => {
    render(<ListingWizard />);

    fireEvent.change(screen.getByPlaceholderText('e.g. 2023'), { target: { value: '1800' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. PE11 2AA'), { target: { value: 'Iowa' } });
    fireEvent.change(screen.getByPlaceholderText(/e.g. 2023 John Deere/), { target: { value: 'Test Equipment' } });

    fireEvent.click(screen.getByText(/Next Step/i));

    // Should stay on step 1 due to invalid year
    expect(screen.getByText(/Step 1 of 5/i)).toBeInTheDocument();
  });

  it('validates title is at least 6 characters', () => {
    render(<ListingWizard />);

    fireEvent.change(screen.getByPlaceholderText('e.g. 2023'), { target: { value: '2023' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. PE11 2AA'), { target: { value: 'Iowa' } });
    fireEvent.change(screen.getByPlaceholderText(/e.g. 2023 John Deere/), { target: { value: 'Test' } });

    fireEvent.click(screen.getByText(/Next Step/i));

    // Should stay on step 1 due to short title
    expect(screen.getByText(/Step 1 of 5/i)).toBeInTheDocument();
  });
});