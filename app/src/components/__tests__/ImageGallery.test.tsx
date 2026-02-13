// app/src/components/__tests__/ImageGallery.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ImageGallery } from '../ImageGallery';
import { describe, it, expect } from 'vitest';

describe('ImageGallery', () => {
  const mockImages = [
    'https://example.com/image1.jpg',
    'https://example.com/image2.jpg',
    'https://example.com/image3.jpg',
  ];

  it('renders the first image as the hero by default', () => {
    render(<ImageGallery images={mockImages} title="Test Equipment" />);
    
    const heroImage = screen.getByAltText('Test Equipment - Main');
    expect(heroImage).toHaveAttribute('src', mockImages[0]);
  });

  it('updates the hero image when a thumbnail is clicked', () => {
    render(<ImageGallery images={mockImages} title="Test Equipment" />);
    
    const thumbnails = screen.getAllByRole('button', { name: /View image/i });
    
    // Click the second thumbnail
    fireEvent.click(thumbnails[1]);
    
    const heroImage = screen.getByAltText('Test Equipment - Main');
    expect(heroImage).toHaveAttribute('src', mockImages[1]);
  });

  it('opens the lightbox when the main image is clicked', () => {
    render(<ImageGallery images={mockImages} title="Test Equipment" />);
    
    const mainImageButton = screen.getByLabelText('Open full-screen gallery');
    fireEvent.click(mainImageButton);
    
    // Check if lightbox content is visible (dialog role)
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByAltText('Test Equipment - Full Screen')).toHaveAttribute('src', mockImages[0]);
  });
});
