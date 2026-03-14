import jsutils from '@laisky/js-utils';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { App } from '../../pages/app';

// Mock dependencies
vi.mock('@laisky/js-utils', () => ({
  default: {
    KvGet: vi.fn(),
    KvSet: vi.fn(),
    LoadJsModules: vi.fn().mockResolvedValue(true),
  },
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

/**
 * createTestRouter creates a memory router for testing the App component.
 * Uses createMemoryRouter to support ScrollRestoration component.
 *
 * @param {string} initialPath - The initial path for the router
 * @returns {Object} Router instance
 */
const createTestRouter = (initialPath = '/') => {
  return createMemoryRouter(
    [
      {
        path: '/',
        element: <App />,
        children: [
          {
            index: true,
            element: <div>Home</div>,
          },
        ],
      },
      {
        path: '*',
        element: <App />,
      },
    ],
    {
      initialEntries: [initialPath],
    }
  );
};

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jsutils.KvGet.mockResolvedValue('en_US');
  });

  afterEach(() => {
    // Clean up any added DOM elements
    const overlay = document.querySelector('.gsc-results-wrapper-overlay');
    if (overlay) {
      overlay.remove();
    }
  });

  test('renders search container with correct classes and attributes', async () => {
    const router = createTestRouter();
    render(<RouterProvider router={router} />);

    const searchContainer = document.querySelector('.navbar-search');
    expect(searchContainer).toBeInTheDocument();
    expect(searchContainer).toHaveClass('navbar-search', 'd-flex');

    const gcseDiv = document.querySelector('.gcse-search');
    expect(gcseDiv).toBeInTheDocument();
    expect(gcseDiv).toHaveAttribute('data-gname', 'post_search');
    expect(gcseDiv).toHaveAttribute('data-enablehistory', 'true');
    expect(gcseDiv).toHaveAttribute('data-enableautocomplete', 'true');
  });

  test('toggles mobile menu when button is clicked', async () => {
    const router = createTestRouter();
    render(<RouterProvider router={router} />);

    const toggler = screen.getByLabelText(/toggle navigation/i);
    const collapse = document.querySelector('.navbar-collapse');

    // Initially closed
    expect(collapse).not.toHaveClass('show');
    expect(toggler).toHaveAttribute('aria-expanded', 'false');

    // Click to open
    fireEvent.click(toggler);
    expect(collapse).toHaveClass('show');
    expect(toggler).toHaveAttribute('aria-expanded', 'true');

    // Click to close
    fireEvent.click(toggler);
    expect(collapse).not.toHaveClass('show');
    expect(toggler).toHaveAttribute('aria-expanded', 'false');
  });

  test('closes mobile menu when Google CSE overlay is added to DOM', async () => {
    const router = createTestRouter();
    render(<RouterProvider router={router} />);

    const toggler = screen.getByLabelText(/toggle navigation/i);
    const collapse = document.querySelector('.navbar-collapse');

    // Open mobile menu
    fireEvent.click(toggler);
    expect(collapse).toHaveClass('show');

    // Simulate Google CSE adding the overlay to the DOM
    await act(async () => {
      const overlay = document.createElement('div');
      overlay.className = 'gsc-results-wrapper-overlay';
      document.body.appendChild(overlay);
      // Wait for MutationObserver to process
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Mobile menu should be closed after overlay appears
    await waitFor(() => {
      expect(collapse).not.toHaveClass('show');
    });
  });

  test('closes mobile menu when element containing GSC overlay is added', async () => {
    const router = createTestRouter();
    render(<RouterProvider router={router} />);

    const toggler = screen.getByLabelText(/toggle navigation/i);
    const collapse = document.querySelector('.navbar-collapse');

    // Open mobile menu
    fireEvent.click(toggler);
    expect(collapse).toHaveClass('show');

    // Simulate a parent element containing the overlay being added
    await act(async () => {
      const parent = document.createElement('div');
      const overlay = document.createElement('div');
      overlay.className = 'gsc-results-wrapper-overlay';
      parent.appendChild(overlay);
      document.body.appendChild(parent);
      // Wait for MutationObserver to process
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Mobile menu should be closed
    await waitFor(() => {
      expect(collapse).not.toHaveClass('show');
    });
  });

  test('mobile menu stays open if unrelated element is added to DOM', async () => {
    const router = createTestRouter();
    render(<RouterProvider router={router} />);

    const toggler = screen.getByLabelText(/toggle navigation/i);
    const collapse = document.querySelector('.navbar-collapse');

    // Open mobile menu
    fireEvent.click(toggler);
    expect(collapse).toHaveClass('show');

    // Add an unrelated element
    await act(async () => {
      const unrelatedDiv = document.createElement('div');
      unrelatedDiv.className = 'some-other-class';
      document.body.appendChild(unrelatedDiv);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Mobile menu should still be open
    expect(collapse).toHaveClass('show');

    // Clean up
    document.querySelector('.some-other-class')?.remove();
  });
});
