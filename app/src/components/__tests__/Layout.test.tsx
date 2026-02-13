import { render, screen } from '@testing-library/react';
import { Layout } from '../Layout';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

// Mock Header and Footer to isolate Layout testing
vi.mock('../Header', () => ({
  Header: () => <header data-testid="mock-header">Header</header>
}));

vi.mock('../Footer', () => ({
  Footer: () => <footer data-testid="mock-footer">Footer</footer>
}));

describe('Layout', () => {
  it('renders children and includes Header and Footer', () => {
    render(
      <BrowserRouter>
        <Layout>
          <div data-testid="child-content">Child Content</div>
        </Layout>
      </BrowserRouter>
    );

    expect(screen.getByTestId('mock-header')).toBeInTheDocument();
    expect(screen.getByTestId('mock-footer')).toBeInTheDocument();
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });
});
