import jsutils from '@laisky/js-utils';
import { act, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { Manage } from '../../pages/manage.jsx';

// Mock dependencies
vi.mock('@laisky/js-utils', () => ({
  default: {
    KvGet: vi.fn(),
    KvSet: vi.fn(),
  },
}));

const mockGraphqlQuery = vi.fn();
const mockGraphqlMutation = vi.fn();
const mockGetUserLanguage = vi.fn().mockResolvedValue('en_US');
const mockGetCurrentUsername = vi.fn();

vi.mock('../../library/base.jsx', () => ({
  formatTs: vi.fn((ts) => ts || ''),
  getCurrentUsername: (...args) => mockGetCurrentUsername(...args),
  getUserLanguage: (...args) => mockGetUserLanguage(...args),
  graphqlQuery: (...args) => mockGraphqlQuery(...args),
  graphqlMutation: (...args) => mockGraphqlMutation(...args),
  KvKeyUserToken: 'user_token',
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const renderManage = () => {
  const router = createMemoryRouter(
    [{ path: '/admin', element: <Manage /> }],
    { initialEntries: ['/admin'] }
  );
  return render(<RouterProvider router={router} />);
};

const makePost = (i, prefix = '') => ({
  name: `${prefix}post-${i}`,
  title: `${prefix}Post ${i}`,
  created_at: '2024-01-01',
  category: { name: 'General', url: '/general' },
});

const makePosts = (n, prefix = '') =>
  Array.from({ length: n }, (_, i) => makePost(i, prefix));

/**
 * Sets up mockGraphqlQuery to respond based on query content.
 * @param {Array<Array>} postPages - Array of post arrays, one per page.
 * @param {Array} categories - Array of category objects.
 */
const setupQueryMock = (postPages, categories = []) => {
  let pageCallIndex = 0;
  mockGraphqlQuery.mockImplementation((query) => {
    if (query.includes('BlogPostCategories')) {
      return Promise.resolve({ BlogPostCategories: categories });
    }
    // It's a BlogPosts query
    const page = postPages[pageCallIndex] || [];
    pageCallIndex++;
    return Promise.resolve({ BlogPosts: page });
  });
};

describe('Manage page - loadAllPosts pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUsername.mockResolvedValue('admin');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('fetches single page when posts < PAGE_SIZE', async () => {
    const posts = makePosts(50);
    setupQueryMock([posts]);

    await act(async () => {
      renderManage();
    });

    await waitFor(() => {
      expect(screen.getByText('50 posts')).toBeTruthy();
    });

    // 1 page of posts + 1 categories = at least 2 calls
    const postCalls = mockGraphqlQuery.mock.calls.filter((c) =>
      c[0].includes('BlogPosts(')
    );
    expect(postCalls).toHaveLength(1);
  });

  test('fetches multiple pages when posts exceed PAGE_SIZE', async () => {
    const page0 = makePosts(200, 'p0-');
    const page1 = makePosts(50, 'p1-');
    setupQueryMock([page0, page1]);

    await act(async () => {
      renderManage();
    });

    await waitFor(() => {
      expect(screen.getByText('250 posts')).toBeTruthy();
    });

    const postCalls = mockGraphqlQuery.mock.calls.filter((c) =>
      c[0].includes('BlogPosts(')
    );
    expect(postCalls).toHaveLength(2);
  });

  test('handles empty response on first page', async () => {
    setupQueryMock([[]]);

    await act(async () => {
      renderManage();
    });

    await waitFor(() => {
      expect(screen.getByText('0 posts')).toBeTruthy();
    });

    const postCalls = mockGraphqlQuery.mock.calls.filter((c) =>
      c[0].includes('BlogPosts(')
    );
    expect(postCalls).toHaveLength(1);
  });

  test('stops when a full page is followed by an empty page', async () => {
    const fullPage = makePosts(200);
    setupQueryMock([fullPage, []]);

    await act(async () => {
      renderManage();
    });

    await waitFor(() => {
      expect(screen.getByText('200 posts')).toBeTruthy();
    });

    const postCalls = mockGraphqlQuery.mock.calls.filter((c) =>
      c[0].includes('BlogPosts(')
    );
    expect(postCalls).toHaveLength(2);
  });

  test('pagination query includes correct page numbers', async () => {
    const fullPage = makePosts(200, 'p0-');
    const partialPage = makePosts(10, 'p1-');
    setupQueryMock([fullPage, partialPage]);

    await act(async () => {
      renderManage();
    });

    await waitFor(() => {
      expect(screen.getByText('210 posts')).toBeTruthy();
    });

    const postCalls = mockGraphqlQuery.mock.calls.filter((c) =>
      c[0].includes('BlogPosts(')
    );

    // Verify page 0 query
    expect(postCalls[0][0]).toContain('page: 0');
    expect(postCalls[0][0]).toContain('size: 200');

    // Verify page 1 query
    expect(postCalls[1][0]).toContain('page: 1');
    expect(postCalls[1][0]).toContain('size: 200');
  });

  test('does not request size > 200', async () => {
    setupQueryMock([makePosts(100)]);

    await act(async () => {
      renderManage();
    });

    await waitFor(() => {
      expect(screen.getByText('100 posts')).toBeTruthy();
    });

    for (const call of mockGraphqlQuery.mock.calls) {
      const query = call[0];
      if (query.includes('BlogPosts(')) {
        const sizeMatch = query.match(/size:\s*(\d+)/);
        if (sizeMatch) {
          expect(Number(sizeMatch[1])).toBeLessThanOrEqual(200);
        }
      }
    }
  });

  test('redirects unauthenticated users', async () => {
    mockGetCurrentUsername.mockResolvedValue(null);

    await act(async () => {
      renderManage();
    });

    expect(mockGraphqlQuery).not.toHaveBeenCalled();
  });
});
