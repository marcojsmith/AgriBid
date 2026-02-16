import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '../Header';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import * as authClient from '../../lib/auth-client';
import * as React from 'react';

const mockNavigate = vi.fn();

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock Convex
vi.mock('convex/react', () => ({
  Authenticated: ({ children }: { children: React.ReactNode }) => <div data-testid="auth">{children}</div>,
  Unauthenticated: ({ children }: { children: React.ReactNode }) => <div data-testid="unauth">{children}</div>,
}));

// Mock auth client
vi.mock('../../lib/auth-client', () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}));

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderHeader = () => {
    return render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    );
  };

  it('renders the brand name and navigation links', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as any);
    renderHeader();
    expect(screen.getByText(/AGRIBID/i)).toBeInTheDocument();
    expect(screen.getByText(/Marketplace/i)).toBeInTheDocument();
    expect(screen.getByText(/Sell/i)).toBeInTheDocument();
  });

  it('renders sign in button when unauthenticated', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as any);
    renderHeader();
    expect(screen.getByText(/Sign In/i)).toBeInTheDocument();
  });

  it('renders user name and sign out button in mobile menu when authenticated', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(authClient.useSession).mockReturnValue({ data: { user: { name: 'John Doe' } }, isPending: false } as any);
    renderHeader();
    expect(screen.getByText(/John Doe/i)).toBeInTheDocument();
    
    // Open mobile menu
    const toggle = screen.getByLabelText(/Toggle menu/i);
    fireEvent.click(toggle);
    
    // Sign out button should be in the mobile menu
    expect(screen.getByText(/Sign Out/i)).toBeInTheDocument();
  });

  it('toggles mobile menu when clicked', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as any);
    renderHeader();
    
    const toggle = screen.getByLabelText(/Toggle menu/i);
    fireEvent.click(toggle);
    
    // Links appear in mobile menu too
    const links = screen.getAllByText(/Marketplace/i);
    expect(links.length).toBeGreaterThan(1);
  });

  it('has hybrid sticky classes', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as any);
    renderHeader();
    const header = screen.getByRole('banner');
    expect(header).toHaveClass('lg:sticky');
  });

  it('handles search submission and redirects', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as any);
    
    renderHeader();
    const searchInput = screen.getByPlaceholderText(/Search equipment/i) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'Tractor' } });
    fireEvent.submit(searchInput.closest('form')!);
    
    // Assert navigation was triggered with the correct path
    expect(mockNavigate).toHaveBeenCalledWith('/?q=Tractor');
    
    // Assert search input was cleared
    expect(searchInput.value).toBe('');
  });

  it('renders search input in mobile menu', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as any);
    renderHeader();
    
    const toggle = screen.getByLabelText(/Toggle menu/i);
    fireEvent.click(toggle);
    
    const mobileSearchInputs = screen.getAllByPlaceholderText(/Search equipment/i);
    expect(mobileSearchInputs.length).toBeGreaterThan(1);
  });

  it('renders admin dashboard link when user has admin role', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(authClient.useSession).mockReturnValue({ 
      data: { user: { name: 'Admin User', role: 'admin' } }, 
      isPending: false 
    } as any);
    
    renderHeader();
    
    // Open mobile menu
    const toggle = screen.getByLabelText(/Toggle menu/i);
    fireEvent.click(toggle);
    
    // Admin link should be in the mobile menu
    expect(screen.getByRole('link', { name: /Admin/i })).toBeInTheDocument();
  });
});
