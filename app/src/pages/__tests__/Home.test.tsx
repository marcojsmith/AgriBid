// app/src/pages/__tests__/Home.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Home from '../Home';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Doc, Id } from 'convex/_generated/dataModel';
import { BrowserRouter } from 'react-router-dom';

const mockAuctions: Doc<"auctions">[] = [
  {
    _id: 'auction1' as Id<"auctions">,
    _creationTime: Date.now(),
    title: 'John Deere 8RX 410',
    make: 'John Deere',
    model: '8RX 410',
    year: 2022,
    location: 'Iowa, USA',
    operatingHours: 1200,
    currentPrice: 50000,
    minIncrement: 500,
    endTime: Date.now() + 100000,
    status: 'active',
    sellerId: 'seller1',
    startingPrice: 40000,
    reservePrice: 45000,
    conditionChecklist: {
      engine: true,
      hydraulics: true,
      tires: true,
      serviceHistory: true,
    },
  },
  {
    _id: 'auction2' as Id<"auctions">,
    _creationTime: Date.now(),
    title: 'Case IH Magnum 340',
    make: 'Case IH',
    model: 'Magnum 340',
    year: 2021,
    location: 'Nebraska, USA',
    operatingHours: 800,
    currentPrice: 45000,
    minIncrement: 500,
    endTime: Date.now() + 200000,
    status: 'active',
    sellerId: 'seller2',
    startingPrice: 35000,
    reservePrice: 40000,
    conditionChecklist: {
      engine: true,
      hydraulics: true,
      tires: false,
      serviceHistory: true,
    },
  },
];

const mockSession = {
  isPending: false,
  data: { user: { id: 'user1', email: 'test@example.com' } },
};

const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
const mockSeedMetadata = vi.fn();
const mockSeedAuctions = vi.fn();

// Mock dependencies
vi.mock('convex/react', () => ({
  Authenticated: ({ children }: any) => <div data-testid="authenticated">{children}</div>,
  Unauthenticated: ({ children }: any) => <div data-testid="unauthenticated">{children}</div>,
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock('../../lib/auth-client', () => ({
  useSession: () => mockSession,
  signIn: {
    email: mockSignIn,
  },
  signUp: {
    email: mockSignUp,
  },
}));

vi.mock('../../components/AuctionCard', () => ({
  AuctionCard: ({ auction }: any) => <div data-testid="auction-card">{auction.title}</div>,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Home', () => {
  const renderWithRouter = (searchQuery = '') => {
    const path = searchQuery ? `/?q=${searchQuery}` : '/';
    window.history.pushState({}, '', path);
    return render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.isPending = false;
    const { useQuery, useMutation } = require('convex/react');
    useQuery.mockReturnValue(mockAuctions);
    useMutation.mockImplementation((fn: any) => {
      if (fn.toString().includes('seedEquipmentMetadata')) return mockSeedMetadata;
      if (fn.toString().includes('seedMockAuctions')) return mockSeedAuctions;
      return vi.fn();
    });
    Object.defineProperty(import.meta, 'env', {
      value: { DEV: true },
      writable: true,
    });
  });

  it('shows loading state while session is pending', () => {
    mockSession.isPending = true;
    renderWithRouter();

    expect(screen.getByText(/AGRIBID LOADING.../i)).toBeInTheDocument();
  });

  it('renders authenticated view with active auctions', () => {
    renderWithRouter();

    expect(screen.getByText('Active Auctions')).toBeInTheDocument();
    expect(screen.getByText('John Deere 8RX 410')).toBeInTheDocument();
    expect(screen.getByText('Case IH Magnum 340')).toBeInTheDocument();
  });

  it('displays auction cards in grid layout', () => {
    const { container } = renderWithRouter();

    const grid = container.querySelector('.grid');
    expect(grid).toBeInTheDocument();

    const auctionCards = screen.getAllByTestId('auction-card');
    expect(auctionCards).toHaveLength(2);
  });

  it('shows sell equipment button when authenticated', () => {
    renderWithRouter();

    const sellButton = screen.getByText('Sell Equipment');
    expect(sellButton).toBeInTheDocument();
    expect(sellButton.closest('a')).toHaveAttribute('href', '/sell');
  });

  it('shows seed mock data button in dev mode', () => {
    renderWithRouter();

    expect(screen.getByText('Seed Mock Data')).toBeInTheDocument();
  });

  it('displays no auctions message when list is empty', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue([]);

    renderWithRouter();

    expect(screen.getByText(/No active auctions at the moment/i)).toBeInTheDocument();
  });

  it('shows loading spinner while fetching auctions', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(null);

    const { container } = renderWithRouter();

    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders search results when query parameter is present', () => {
    renderWithRouter('John Deere');

    expect(screen.getByText(/Results for "John Deere"/i)).toBeInTheDocument();
  });

  it('shows clear search button when displaying search results', () => {
    renderWithRouter('tractors');

    const clearButton = screen.getByText('Clear search results');
    expect(clearButton).toBeInTheDocument();
  });

  it('displays no results message for empty search', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue([]);

    renderWithRouter('nonexistent');

    expect(screen.getByText(/No auctions found matching "nonexistent"/i)).toBeInTheDocument();
  });

  it('renders unauthenticated view with sign in form', () => {
    // Mock Authenticated and Unauthenticated to actually conditionally render
    const { Authenticated, Unauthenticated } = require('convex/react');
    Authenticated.mockImplementation(() => null);
    Unauthenticated.mockImplementation(({ children }: any) => children);

    renderWithRouter();

    expect(screen.getByText('FIELD TO MARKET')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('name@farm.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  it('allows switching between sign in and sign up modes', () => {
    const { Authenticated, Unauthenticated } = require('convex/react');
    Authenticated.mockImplementation(() => null);
    Unauthenticated.mockImplementation(({ children }: any) => children);

    renderWithRouter();

    expect(screen.getByText('Sign In to AgriBid')).toBeInTheDocument();

    const switchButton = screen.getByText('Switch to Registration');
    fireEvent.click(switchButton);

    expect(screen.getByText('Create Verified Account')).toBeInTheDocument();
  });

  it('validates email and password inputs', () => {
    const { Authenticated, Unauthenticated } = require('convex/react');
    Authenticated.mockImplementation(() => null);
    Unauthenticated.mockImplementation(({ children }: any) => children);

    renderWithRouter();

    const emailInput = screen.getByPlaceholderText('name@farm.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');

    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('required');
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveAttribute('required');
  });

  it('handles sign in form submission', async () => {
    const { Authenticated, Unauthenticated } = require('convex/react');
    Authenticated.mockImplementation(() => null);
    Unauthenticated.mockImplementation(({ children }: any) => children);

    mockSignIn.mockResolvedValue({ error: null });

    renderWithRouter();

    const emailInput = screen.getByPlaceholderText('name@farm.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    const signInButton = screen.getByText('Sign In to AgriBid');
    fireEvent.click(signInButton);

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('handles sign up form submission', async () => {
    const { Authenticated, Unauthenticated } = require('convex/react');
    Authenticated.mockImplementation(() => null);
    Unauthenticated.mockImplementation(({ children }: any) => children);

    mockSignUp.mockResolvedValue({ error: null });

    renderWithRouter();

    // Switch to sign up mode
    fireEvent.click(screen.getByText('Switch to Registration'));

    const emailInput = screen.getByPlaceholderText('name@farm.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');

    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    const signUpButton = screen.getByText('Create Verified Account');
    fireEvent.click(signUpButton);

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalled();
    });
  });

  it('displays error message on authentication failure', async () => {
    const { Authenticated, Unauthenticated } = require('convex/react');
    Authenticated.mockImplementation(() => null);
    Unauthenticated.mockImplementation(({ children }: any) => children);

    mockSignIn.mockResolvedValue({ error: { message: 'Invalid credentials' } });

    renderWithRouter();

    const emailInput = screen.getByPlaceholderText('name@farm.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrong' } });

    const signInButton = screen.getByText('Sign In to AgriBid');
    fireEvent.click(signInButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('shows loading state during sign in', async () => {
    const { Authenticated, Unauthenticated } = require('convex/react');
    Authenticated.mockImplementation(() => null);
    Unauthenticated.mockImplementation(({ children }: any) => children);

    mockSignIn.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ error: null }), 100)));

    renderWithRouter();

    const emailInput = screen.getByPlaceholderText('name@farm.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    const signInButton = screen.getByText('Sign In to AgriBid');
    fireEvent.click(signInButton);

    expect(screen.getByText('Signing in...')).toBeInTheDocument();
  });

  it('calls seed functions when seed button is clicked', async () => {
    mockSeedMetadata.mockResolvedValue({});
    mockSeedAuctions.mockResolvedValue({});

    renderWithRouter();

    const seedButton = screen.getByText('Seed Mock Data');
    fireEvent.click(seedButton);

    await waitFor(() => {
      expect(mockSeedMetadata).toHaveBeenCalled();
      expect(mockSeedAuctions).toHaveBeenCalled();
    });
  });

  it('shows view all auctions button when search returns no results', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue([]);

    renderWithRouter('test search');

    const viewAllButton = screen.getByText('View All Auctions');
    expect(viewAllButton).toBeInTheDocument();
  });

  it('generates name from email prefix during sign up', async () => {
    const { Authenticated, Unauthenticated } = require('convex/react');
    Authenticated.mockImplementation(() => null);
    Unauthenticated.mockImplementation(({ children }: any) => children);

    mockSignUp.mockResolvedValue({ error: null });

    renderWithRouter();

    fireEvent.click(screen.getByText('Switch to Registration'));

    const emailInput = screen.getByPlaceholderText('name@farm.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');

    fireEvent.change(emailInput, { target: { value: 'john.doe123@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    const signUpButton = screen.getByText('Create Verified Account');
    fireEvent.click(signUpButton);

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'john.doe123@example.com',
          password: 'password123',
          name: expect.stringMatching(/^[A-Z]/), // Should be capitalized
        })
      );
    });
  });

  it('displays tagline for sign in mode', () => {
    const { Authenticated, Unauthenticated } = require('convex/react');
    Authenticated.mockImplementation(() => null);
    Unauthenticated.mockImplementation(({ children }: any) => children);

    renderWithRouter();

    expect(screen.getByText('Real-Time Bidding for Serious Farmers')).toBeInTheDocument();
  });

  it('displays tagline for sign up mode', () => {
    const { Authenticated, Unauthenticated } = require('convex/react');
    Authenticated.mockImplementation(() => null);
    Unauthenticated.mockImplementation(({ children }: any) => children);

    renderWithRouter();

    fireEvent.click(screen.getByText('Switch to Registration'));

    expect(screen.getByText('Join the Leading Agricultural Marketplace')).toBeInTheDocument();
  });
});