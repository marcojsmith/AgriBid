import { render, screen } from '@testing-library/react';
import App from './App';
import { describe, it, expect, vi } from 'vitest';

// Mock the pages to avoid Convex dependencies in this unit test
vi.mock('./pages/Home', () => ({ default: () => <div data-testid="home-page">Home Page</div> }));
vi.mock('./pages/AuctionDetail', () => ({ default: () => <div data-testid="detail-page">Detail Page</div> }));
vi.mock('./pages/Sell', () => ({ default: () => <div data-testid="sell-page">Sell Page</div> }));

describe('App', () => {
  it('renders within the Layout (contains AGRIBID header)', () => {
    render(<App />);
    // The Header and Footer placeholders both contain "AGRIBID"
    expect(screen.getAllByText(/AGRIBID/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId('home-page')).toBeInTheDocument();
  });
});
