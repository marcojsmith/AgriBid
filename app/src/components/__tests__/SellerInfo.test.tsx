// app/src/components/__tests__/SellerInfo.test.tsx
import { render, screen } from '@testing-library/react';
import { SellerInfo } from '../SellerInfo';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSeller = {
  name: 'John Smith',
  role: 'Verified Dealer',
  isVerified: true,
  createdAt: new Date('2020-01-15').getTime(),
};

const mockUnverifiedSeller = {
  name: 'Jane Doe',
  role: 'Private Seller',
  isVerified: false,
  createdAt: new Date('2023-06-01').getTime(),
};

// Mock Convex hooks
vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}));

describe('SellerInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders seller details correctly', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue({
      name: 'Verified Farmer',
      isVerified: true,
      role: 'Commercial Dealer',
      createdAt: Date.now() - 31536000000, // 1 year ago
    });

    render(<SellerInfo sellerId="seller123" />);

    expect(screen.getByText('Verified Farmer')).toBeInTheDocument();
    expect(screen.getByText('Commercial Dealer')).toBeInTheDocument();
    expect(screen.getByText(/High-Integrity Verification/i)).toBeInTheDocument();
  });

  it('renders loading state while fetching seller data', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(undefined);

    render(<SellerInfo sellerId="seller123" />);

    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('renders seller unavailable message when seller is null', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(null);

    render(<SellerInfo sellerId="seller123" />);

    expect(screen.getByText(/Seller information unavailable/i)).toBeInTheDocument();
  });

  it('renders verified seller information correctly', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(mockSeller);

    render(<SellerInfo sellerId="seller123" />);

    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('Verified Dealer')).toBeInTheDocument();
    expect(screen.getByText(/Member since 2020/i)).toBeInTheDocument();
  });

  it('displays verification badge for verified sellers', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(mockSeller);

    render(<SellerInfo sellerId="seller123" />);

    const verificationBadges = document.querySelectorAll('svg');
    expect(verificationBadges.length).toBeGreaterThan(0);
  });

  it('does not show verification message for unverified sellers', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(mockUnverifiedSeller);

    render(<SellerInfo sellerId="seller456" />);

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.queryByText(/High-Integrity Verification/i)).not.toBeInTheDocument();
  });

  it('renders message button with correct aria label', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(mockSeller);

    render(<SellerInfo sellerId="seller123" />);

    const messageButton = screen.getByLabelText('Message John Smith');
    expect(messageButton).toBeInTheDocument();
    expect(screen.getByText('Message')).toBeInTheDocument();
  });

  it('renders view profile button with correct aria label', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(mockSeller);

    render(<SellerInfo sellerId="seller123" />);

    const profileButton = screen.getByLabelText("View John Smith's profile");
    expect(profileButton).toBeInTheDocument();
    expect(screen.getByText('View Profile')).toBeInTheDocument();
  });

  it('displays seller role badge', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(mockSeller);

    render(<SellerInfo sellerId="seller123" />);

    expect(screen.getByText('Verified Dealer')).toBeInTheDocument();
  });

  it('calculates member since year correctly', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue({
      name: 'Test User',
      role: 'Seller',
      isVerified: false,
      createdAt: new Date('2019-12-31').getTime(),
    });

    render(<SellerInfo sellerId="seller789" />);

    expect(screen.getByText(/Member since 2019/i)).toBeInTheDocument();
  });

  it('handles recent member year correctly', () => {
    const { useQuery } = require('convex/react');
    const currentYear = new Date().getFullYear();
    useQuery.mockReturnValue({
      ...mockSeller,
      createdAt: new Date(`${currentYear}-01-01`).getTime(),
    });

    render(<SellerInfo sellerId="seller123" />);

    expect(screen.getByText(new RegExp(`Member since ${currentYear}`, 'i'))).toBeInTheDocument();
  });

  it('displays loading skeleton with correct structure', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(undefined);

    const { container } = render(<SellerInfo sellerId="seller123" />);

    const loadingContainer = container.querySelector('.animate-pulse');
    expect(loadingContainer).toBeInTheDocument();

    const avatarPlaceholder = container.querySelector('.rounded-full');
    expect(avatarPlaceholder).toBeInTheDocument();
  });

  it('shows dashed border for unavailable seller info', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(null);

    const { container } = render(<SellerInfo sellerId="seller123" />);

    const dashedBorder = container.querySelector('.border-dashed');
    expect(dashedBorder).toBeInTheDocument();
  });
});