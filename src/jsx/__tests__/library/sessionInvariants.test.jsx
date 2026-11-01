import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const code = 'A'.repeat(43);
const state = 'B'.repeat(42) + 'A';
const verifier = 'C'.repeat(42) + 'A';
const SignInError = 'Sign-in could not be completed. Please try again.';

/** durable holds the values that survive a reload, standing in for the PouchDB database. */
const durable = new Map();
/** failures maps a js-utils operation to the behavior that replaces it during a test. */
const failures = {};
const navigate = vi.fn();

vi.mock('@laisky/js-utils', () => ({
  default: {
    KvGet: vi.fn(async (key) => (failures.get ? failures.get(key) : (durable.get(key) ?? null))),
    KvSet: vi.fn(async (key, value) => {
      if (failures.set) return failures.set(key, value);
      durable.set(key, value);
    }),
    KvDel: vi.fn(async (key) => {
      if (failures.del) return failures.del(key);
      durable.delete(key);
    }),
  },
}));
vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => navigate }));

/** makeToken builds an unsigned JWT with the supplied claims for local UI decoding. */
const makeToken = (claims) => {
  const encode = (value) => globalThis.btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `${encode({ alg: 'none' })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, ...claims })}.signature`;
};

/** freshPage loads new module instances, which is what a reload does to page memory. */
const freshPage = async () => {
  vi.resetModules();
  const base = await import('../../library/base.jsx');
  const sso = await import('../../library/sso.jsx');
  const storage = await import('../../library/storage.js');
  const { Admin } = await import('../../components/admin.jsx');
  return { ...base, ...sso, ...storage, Admin };
};

/** mountAdmin renders the real admin panel for the supplied page instance. */
const mountAdmin = ({ Admin }) =>
  render(
    <MemoryRouter>
      <Admin />
    </MemoryRouter>
  );

/** startCallback prepares a valid SSO callback that exchanges to the supplied token. */
const startCallback = (token) => {
  const url = new URL(`https://blog.laisky.com/?sso_code=${code}&sso_state=${state}`);
  delete window.location;
  window.location = { href: url.toString(), origin: url.origin, pathname: '/', search: url.search, hash: '', replace: vi.fn() };
  window.sessionStorage.setItem(
    'sso_code_transaction',
    JSON.stringify({ state, verifier, createdAt: Date.now() - 1000, redirectPath: '/pages/0/' })
  );
  const body = new TextEncoder().encode(JSON.stringify({ token_type: 'Bearer', expires_in: 3600, access_token: token }));
  let consumed = false;
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    headers: { get: () => 'application/json' },
    body: {
      getReader: () => ({
        read: async () => {
          if (consumed) return { done: true };
          consumed = true;
          return { done: false, value: body };
        },
        cancel: vi.fn(),
      }),
    },
  }));
};

const originalLocation = window.location;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  durable.clear();
  delete failures.get;
  delete failures.set;
  delete failures.del;
  navigate.mockClear();
  vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  window.location = originalLocation;
  globalThis.fetch = originalFetch;
  window.sessionStorage.clear();
});

describe('logout never claims success while a durable token remains', () => {
  it('keeps the visible session and offers a retry when the token cannot be deleted', async () => {
    const token = makeToken({ display_name: 'Alice', sub: 'alice' });
    durable.set('user_token', token);
    failures.del = async () => {
      throw new Error('storage unavailable');
    };
    const page = await freshPage();
    mountAdmin(page);
    fireEvent.click(await screen.findByText('Logout'));

    expect((await screen.findByRole('alert')).textContent).toMatch(/Sign-out could not be completed/);
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByText(/Welcome, Alice/)).toBeInTheDocument();
    expect(durable.get('user_token')).toBe(token);

    delete failures.del;
    fireEvent.click(screen.getByText('Logout'));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(0));
    expect(durable.has('user_token')).toBe(false);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('tells the truth about a token that is still there after a reload', async () => {
    const token = makeToken({ display_name: 'Alice', sub: 'alice' });
    durable.set('user_token', token);
    failures.del = async () => {
      throw new Error('storage unavailable');
    };
    const page = await freshPage();
    mountAdmin(page);
    fireEvent.click(await screen.findByText('Logout'));
    await screen.findByRole('alert');

    expect(navigate).not.toHaveBeenCalled();

    delete failures.del;
    const reloaded = await freshPage();
    await expect(reloaded.getCurrentUsername()).resolves.toBe('Alice');
    await expect(reloaded.requireUserToken()).resolves.toBe(token);
  });

  it('attempts the delete even after an earlier timeout marked the store as stalled', async () => {
    durable.set('user_token', makeToken({ display_name: 'Alice', sub: 'alice' }));
    const page = await freshPage();
    mountAdmin(page);
    await screen.findByText('Logout');
    failures.get = () => new Promise(() => {});
    await page.kvGet('language');
    delete failures.get;

    fireEvent.click(screen.getByText('Logout'));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(0));
    expect(durable.has('user_token')).toBe(false);
  }, 6000);

  it('treats a cached identity as secondary, so its removal cannot fail the logout', async () => {
    durable.set('user_token', makeToken({ display_name: 'Alice', sub: 'alice' }));
    durable.set('auth_user', { display_name: 'Alice', sub: 'alice' });
    failures.del = async (key) => {
      if (key === 'auth_user') throw new Error('storage unavailable');
      durable.delete(key);
    };
    const page = await freshPage();
    mountAdmin(page);
    fireEvent.click(await screen.findByText('Logout'));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(0));
    expect(durable.has('user_token')).toBe(false);
  });

  it('removes both keys on an ordinary logout', async () => {
    durable.set('user_token', makeToken({ display_name: 'Alice', sub: 'alice' }));
    durable.set('auth_user', { display_name: 'Alice', sub: 'alice' });
    const page = await freshPage();
    mountAdmin(page);
    fireEvent.click(await screen.findByText('Logout'));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(0));
    expect([...durable.keys()]).toEqual([]);
  });
});

describe('the displayed identity always matches the bearer token', () => {
  it('ignores a cached identity left behind by an incomplete rollback', async () => {
    durable.set('user_token', makeToken({ display_name: 'Alice', sub: 'alice' }));
    durable.set('auth_user', { display_name: 'Mallory', sub: 'mallory' });
    const page = await freshPage();
    await expect(page.getCurrentUsername()).resolves.toBe('Alice');
    await expect(page.requireUserToken()).resolves.toBe(durable.get('user_token'));
  });

  it('keeps showing an existing session whose cached identity matches', async () => {
    const claims = { display_name: 'Alice', sub: 'alice' };
    durable.set('user_token', makeToken(claims));
    durable.set('auth_user', claims);
    const page = await freshPage();
    await expect(page.getCurrentUsername()).resolves.toBe('Alice');
  });

  it('never needs the identity record to read a token that outlived it', async () => {
    durable.set('user_token', makeToken({ username: 'alice-handle', sub: 'alice' }));
    const page = await freshPage();
    await expect(page.getCurrentUsername()).resolves.toBe('alice-handle');
  });
});

describe('sign-in replaces a session in one step', () => {
  const previousToken = makeToken({ display_name: 'Alice', sub: 'alice' });
  const nextToken = makeToken({ display_name: 'Bob', sub: 'bob' });

  it('shows the account of the token that actually survived a failed sign-in', async () => {
    durable.set('user_token', previousToken);
    durable.set('auth_user', { display_name: 'Alice', sub: 'alice' });
    startCallback(nextToken);
    failures.set = async (key, value) => {
      if (key === 'user_token') throw new Error('quota exceeded');
      if (value?.sub === 'alice') throw new Error('rollback failed');
      durable.set(key, value);
    };
    const page = await freshPage();
    await expect(page.consumeSSOCallbackToken()).rejects.toThrow(SignInError);
    delete failures.set;

    const reloaded = await freshPage();
    await expect(reloaded.getCurrentUsername()).resolves.toBe('Alice');
    await expect(reloaded.requireUserToken()).resolves.toBe(previousToken);
  });

  it('switches account completely when the token write succeeds', async () => {
    durable.set('user_token', previousToken);
    durable.set('auth_user', { display_name: 'Alice', sub: 'alice' });
    startCallback(nextToken);
    const page = await freshPage();
    await expect(page.consumeSSOCallbackToken()).resolves.toBe(true);

    const reloaded = await freshPage();
    await expect(reloaded.getCurrentUsername()).resolves.toBe('Bob');
    await expect(reloaded.requireUserToken()).resolves.toBe(nextToken);
  });

  it('succeeds even when clearing the old identity record fails', async () => {
    durable.set('user_token', previousToken);
    durable.set('auth_user', { display_name: 'Alice', sub: 'alice' });
    startCallback(nextToken);
    failures.del = async (key) => {
      if (key === 'auth_user') throw new Error('storage unavailable');
      durable.delete(key);
    };
    const page = await freshPage();
    await expect(page.consumeSSOCallbackToken()).resolves.toBe(true);

    const reloaded = await freshPage();
    await expect(reloaded.getCurrentUsername()).resolves.toBe('Bob');
  });

  it('never reports success when the token could not be stored durably', async () => {
    startCallback(nextToken);
    failures.set = async () => {
      throw new Error('storage unavailable');
    };
    const page = await freshPage();
    await expect(page.consumeSSOCallbackToken()).rejects.toThrow(SignInError);
    expect(window.location.replace).not.toHaveBeenCalled();
    delete failures.set;

    const reloaded = await freshPage();
    await expect(reloaded.getCurrentUsername()).resolves.toBeUndefined();
  });
});
