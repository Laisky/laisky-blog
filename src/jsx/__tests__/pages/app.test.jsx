import jsutils from '@laisky/js-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
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

describe('App Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        jsutils.KvGet.mockResolvedValue('en_US');
    });

    test('renders search container with correct classes and attributes', async () => {
        render(
            <MemoryRouter>
                <App />
            </MemoryRouter>
        );

        const searchContainer = document.querySelector('.navbar-search');
        expect(searchContainer).toBeInTheDocument();
        expect(searchContainer).toHaveClass('d-flex', 'align-items-center');

        const gcseDiv = document.querySelector('.gcse-search');
        expect(gcseDiv).toBeInTheDocument();
        expect(gcseDiv).toHaveAttribute('data-gname', 'post_search');
        expect(gcseDiv).toHaveAttribute('data-enablehistory', 'true');
        expect(gcseDiv).toHaveAttribute('data-enableautocomplete', 'true');
    });

    test('toggles mobile menu when button is clicked', async () => {
        render(
            <MemoryRouter>
                <App />
            </MemoryRouter>
        );

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
});
