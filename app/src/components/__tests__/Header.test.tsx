/* eslint-disable @typescript-eslint/no-explicit-any */
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

// Mock DropdownMenu components to render children directly
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown">{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-trigger">{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-item">{children}</div>,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
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
    vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as unknown as any);
    renderHeader();
    expect(screen.getByText(/AGRIBID/i)).toBeInTheDocument();
    expect(screen.getByText(/Marketplace/i)).toBeInTheDocument();
    expect(screen.getByText(/Sell/i)).toBeInTheDocument();
  });

  it('renders sign in button when unauthenticated', () => {
    vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as unknown as any);
    renderHeader();
    expect(screen.getByText(/Login \/ Register/i)).toBeInTheDocument();
  });

  it('renders user name and sign out button in mobile menu when authenticated', () => {
    vi.mocked(authClient.useSession).mockReturnValue({ data: { user: { name: 'John Doe' } }, isPending: false } as unknown as any);
    renderHeader();
    expect(screen.getAllByText(/John Doe/i).length).toBeGreaterThanOrEqual(1);
    
    // Open mobile menu
    const toggle = screen.getByLabelText(/Toggle menu/i);
    fireEvent.click(toggle);
    
    // Sign out button should be present (at least one for mobile, one for desktop dropdown)
    expect(screen.getAllByText(/Sign Out/i).length).toBeGreaterThanOrEqual(1);
  });

  it('toggles mobile menu when clicked', () => {
    vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as unknown as any);
    renderHeader();
    
    const toggle = screen.getByLabelText(/Toggle menu/i);
    fireEvent.click(toggle);
    
    // Links appear in mobile menu too
    const links = screen.getAllByText(/Marketplace/i);
    expect(links.length).toBeGreaterThan(1);
  });

  it('has hybrid sticky classes', () => {
    vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as unknown as any);
    renderHeader();
    const header = screen.getByRole('banner');
    expect(header).toHaveClass('lg:sticky');
  });

  it('handles search submission and redirects', () => {
    vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as unknown as any);
    
    renderHeader();
    // Use first search input (desktop)
    const searchInput = screen.getAllByPlaceholderText(/Search equipment/i)[0] as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'Tractor' } });
    fireEvent.submit(searchInput.closest('form')!);
    
    // Assert navigation was triggered with the correct path
    expect(mockNavigate).toHaveBeenCalledWith('/?q=Tractor');
    
    // Assert search input was cleared
    expect(searchInput.value).toBe('');
  });

  it('renders search input in mobile menu', () => {
    vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as unknown as any);
    renderHeader();
    
    const toggle = screen.getByLabelText(/Toggle menu/i);
    fireEvent.click(toggle);
    
    const mobileSearchInputs = screen.getAllByPlaceholderText(/Search equipment/i);
    expect(mobileSearchInputs.length).toBeGreaterThan(1);
  });

  it('renders admin link when user has admin role', () => {
    vi.mocked(authClient.useSession).mockReturnValue({ 
      data: { user: { name: 'Admin User', role: 'admin' } }, 
      isPending: false 
    } as unknown as any);
    
    renderHeader();
    
    // Open mobile menu
    const toggle = screen.getByLabelText(/Toggle menu/i);
    fireEvent.click(toggle);
    
    // Admin link should be present (multiple due to desktop/mobile duplication)
    expect(screen.getAllByRole('link', { name: /Admin/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('verifies admin link visibility in desktop navigation', () => {
    vi.mocked(authClient.useSession).mockReturnValue({ 
      data: { user: { name: 'Admin User', role: 'admin' } }, 
      isPending: false 
    } as unknown as any);
    
    renderHeader();
    
    // Admin link should be present
    expect(screen.getAllByRole('link', { name: /Admin/i }).length).toBeGreaterThanOrEqual(1);
  });
});
