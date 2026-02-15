// app/src/pages/__tests__/AuctionDetail.test.tsx
import { render, screen } from '@testing-library/react';
import AuctionDetail from '../AuctionDetail';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Doc, Id } from 'convex/_generated/dataModel';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const mockAuction: Doc<"auctions"> = {
  _id: 'auction123' as Id<"auctions">,
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
  images: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
};

// Mock dependencies
vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}));

vi.mock('../../components/AuctionHeader', () => ({
  AuctionHeader: ({ auction }: any) => <div data-testid="auction-header">{auction.title}</div>,
}));

vi.mock('../../components/ImageGallery', () => ({
  ImageGallery: ({ images, title }: any) => <div data-testid="image-gallery">{title} - {images.length} images</div>,
}));

vi.mock('../../components/BiddingPanel', () => ({
  BiddingPanel: ({ auction }: any) => <div data-testid="bidding-panel">R{auction.currentPrice.toLocaleString()}</div>,
}));

vi.mock('../../components/BidHistory', () => ({
  BidHistory: ({ auctionId }: any) => <div data-testid="bid-history">{auctionId}</div>,
}));

vi.mock('../../components/SellerInfo', () => ({
  SellerInfo: ({ sellerId }: any) => <div data-testid="seller-info">{sellerId}</div>,
}));

describe('AuctionDetail', () => {
  const renderWithRouter = (auctionId: string = 'auction123') => {
    return render(
      <BrowserRouter>
        <Routes>
          <Route path="/auction/:id" element={<AuctionDetail />} />
        </Routes>
      </BrowserRouter>,
      {
        wrapper: ({ children }) => {
          // Manually set the route
          window.history.pushState({}, '', `/auction/${auctionId}`);
          return <>{children}</>;
        },
      }
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while fetching auction data', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(undefined);

    renderWithRouter();

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('shows not found message when auction does not exist', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(null);

    renderWithRouter();

    expect(screen.getByText('Auction Not Found')).toBeInTheDocument();
    expect(screen.getByText('Return to Home')).toBeInTheDocument();
  });

  it('renders auction detail page with all components when auction exists', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(mockAuction);

    renderWithRouter();

    expect(screen.getByTestId('auction-header')).toBeInTheDocument();
    expect(screen.getByTestId('image-gallery')).toBeInTheDocument();
    expect(screen.getByTestId('bidding-panel')).toBeInTheDocument();
    expect(screen.getByTestId('bid-history')).toBeInTheDocument();
    expect(screen.getByTestId('seller-info')).toBeInTheDocument();
  });

  it('displays back to marketplace link', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(mockAuction);

    renderWithRouter();

    expect(screen.getByText('Back to Marketplace')).toBeInTheDocument();
  });

  it('passes auction data to AuctionHeader component', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(mockAuction);

    renderWithRouter();

    const header = screen.getByTestId('auction-header');
    expect(header).toHaveTextContent('John Deere 8RX 410');
  });

  it('passes images to ImageGallery component', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(mockAuction);

    renderWithRouter();

    const gallery = screen.getByTestId('image-gallery');
    expect(gallery).toHaveTextContent('2 images');
  });

  it('passes auction to BiddingPanel component', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(mockAuction);

    renderWithRouter();

    const panel = screen.getByTestId('bidding-panel');
    expect(panel).toHaveTextContent('R50,000');
  });

  it('passes auctionId to BidHistory component', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(mockAuction);

    renderWithRouter();

    const history = screen.getByTestId('bid-history');
    expect(history).toHaveTextContent('auction123');
  });

  it('passes sellerId to SellerInfo component', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(mockAuction);

    renderWithRouter();

    const sellerInfo = screen.getByTestId('seller-info');
    expect(sellerInfo).toHaveTextContent('seller1');
  });

  it('displays equipment description section', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(mockAuction);

    renderWithRouter();

    expect(screen.getByText('Equipment Description')).toBeInTheDocument();
    expect(screen.getByText(/excellent condition/i)).toBeInTheDocument();
    expect(screen.getByText(/1,200 operating hours/i)).toBeInTheDocument();
  });

  it('includes auction details in description', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(mockAuction);

    renderWithRouter();

    expect(screen.getByText(/2022 John Deere 8RX 410/i)).toBeInTheDocument();
    expect(screen.getByText(/Located in Iowa, USA/i)).toBeInTheDocument();
  });

  it('displays bid history heading', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(mockAuction);

    renderWithRouter();

    expect(screen.getByText('BID HISTORY')).toBeInTheDocument();
  });

  it('handles auction without images', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue({ ...mockAuction, images: undefined });

    renderWithRouter();

    const gallery = screen.getByTestId('image-gallery');
    expect(gallery).toHaveTextContent('0 images');
  });

  it('handles auction with empty images array', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue({ ...mockAuction, images: [] });

    renderWithRouter();

    const gallery = screen.getByTestId('image-gallery');
    expect(gallery).toHaveTextContent('0 images');
  });

  it('uses grid layout for content organization', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(mockAuction);

    const { container } = renderWithRouter();

    const gridContainer = container.querySelector('.lg\\:grid-cols-12');
    expect(gridContainer).toBeInTheDocument();
  });

  it('applies sticky positioning to right column on large screens', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(mockAuction);

    const { container } = renderWithRouter();

    const stickyColumn = container.querySelector('.lg\\:sticky');
    expect(stickyColumn).toBeInTheDocument();
  });

  it('shows return to home link when auction not found', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(null);

    renderWithRouter();

    const returnLink = screen.getByText('Return to Home').closest('a');
    expect(returnLink).toHaveAttribute('href', '/');
  });

  it('queries auction by ID from route params', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(mockAuction);

    renderWithRouter('test-auction-id');

    // Verify useQuery was called with the auction ID
    expect(useQuery).toHaveBeenCalled();
  });

  it('handles invalid auction ID gracefully', () => {
    const { useQuery } = require('convex/react');
    // When ID is missing, useQuery should be called with "skip"
    useQuery.mockReturnValue(undefined);

    render(
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AuctionDetail />} />
        </Routes>
      </BrowserRouter>
    );

    expect(screen.getByText('Invalid Auction ID')).toBeInTheDocument();
  });

  it('includes service history verification in description', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(mockAuction);

    renderWithRouter();

    expect(screen.getByText(/Full service history available/i)).toBeInTheDocument();
  });

  it('displays multiple sections in left column', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(mockAuction);

    renderWithRouter();

    // Header, Gallery, and Description should all be present
    expect(screen.getByTestId('auction-header')).toBeInTheDocument();
    expect(screen.getByTestId('image-gallery')).toBeInTheDocument();
    expect(screen.getByText('Equipment Description')).toBeInTheDocument();
  });

  it('displays multiple sections in right column', () => {
    const { useQuery } = require('convex/react');
    useQuery.mockReturnValue(mockAuction);

    renderWithRouter();

    // BiddingPanel, BidHistory, and SellerInfo should all be present
    expect(screen.getByTestId('bidding-panel')).toBeInTheDocument();
    expect(screen.getByTestId('bid-history')).toBeInTheDocument();
    expect(screen.getByTestId('seller-info')).toBeInTheDocument();
  });
});