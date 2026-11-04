import React from 'react';
import jsutils from '@laisky/js-utils';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Admin } from '../../components/admin.jsx';
import { getCurrentUsername, KvKeyAuthUser, KvKeyUserToken, saveSession } from '../../library/session.js';
import { kvGet, kvSet, kvSubscribe } from '../../library/storage.js';
import { isHistoryDenial } from '../../pages/historyDenial.js';

vi.mock('@laisky/js-utils', () => ({
  default: { KvGet: vi.fn(), KvSet: vi.fn(), KvDel: vi.fn(), GetCache: vi.fn(), SetCache: vi.fn() },
}));
// A short deadline keeps these lifecycle tests on real timers, which the rendered components need.
vi.mock('../../library/asyncWork.js', async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, runAsyncWork: (start, options = {}) => original.runAsyncWork(start, { ...options, timeoutMs: 25 }) };
});

const stored = new Map();
let pending = [];

/** token builds an unsigned local fixture token for a display name. */
const token = (name, expiresIn = 300) => {
  const encode = (value) => window.btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'none' })}.${encode({ display_name: name, exp: Math.floor(Date.now() / 1000) + expiresIn })}.local-only`;
};

/** hold makes the next store call wait until the test releases it, as a slow store would. */
const hold = (mock, apply = () => {}) => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const original = mock.getMockImplementation();
  mock.mockImplementationOnce(async (...args) => {
    await gate;
    apply(...args);
    return original(...args);
  });
  pending.push(release);
  return release;
};

/** settle lets a released store call and its follow-up work finish. */
const settle = () => act(async () => new Promise((resolve) => globalThis.setTimeout(resolve, 60)));

/** startWrite lets a write reach the store, well inside the shortened deadline. */
const startWrite = () => new Promise((resolve) => globalThis.setTimeout(resolve, 1));

/** mountAdmin renders the real admin panel through the real router. */
const mountAdmin = () => {
  const router = createMemoryRouter([{ path: '/', element: <Admin /> }], { initialEntries: ['/'] });
  return render(<RouterProvider router={router} />);
};

beforeEach(() => {
  stored.clear();
  pending = [];
  jsutils.KvGet.mockReset();
  jsutils.KvSet.mockReset();
  jsutils.KvDel.mockReset();
  jsutils.KvGet.mockImplementation(async (key) => stored.get(key) ?? null);
  jsutils.KvSet.mockImplementation(async (key, value) => {
    stored.set(key, value);
  });
  jsutils.KvDel.mockImplementation(async (key) => {
    stored.delete(key);
  });
});

afterEach(async () => {
  // Every held call settles, so a store marked as stalled recovers before the next test.
  pending.forEach((release) => release());
  await settle();
  jsutils.KvGet.mockImplementation(async (key) => stored.get(key) ?? null);
  await kvGet('recovered');
});

describe('the admin panel', () => {
  it('offers Login to someone who is signed out, and shows the name of someone signed in', async () => {
    const { unmount } = mountAdmin();
    expect(await screen.findByRole('button', { name: 'Login' })).toBeInTheDocument();
    unmount();
    stored.set(KvKeyUserToken, token('Reader'));
    mountAdmin();
    expect(await screen.findByText(/Welcome, Reader/)).toBeInTheDocument();
  });

  it('does not offer Login to a reader whose sign-in cannot be read', async () => {
    stored.set(KvKeyUserToken, token('Reader'));
    hold(jsutils.KvGet);
    mountAdmin();
    expect(await screen.findByText(/sign-in status is unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Login' })).not.toBeInTheDocument();
  });

  it('shows the signed-in reader once storage recovers, without a reload', async () => {
    stored.set(KvKeyUserToken, token('Reader'));
    const release = hold(jsutils.KvGet);
    mountAdmin();
    await settle();
    expect(screen.queryByText(/Welcome, Reader/)).not.toBeInTheDocument();
    release();
    expect(await screen.findByText(/Welcome, Reader/)).toBeInTheDocument();
  });

  it('reconciles after a sign-out that reported failure later commits', async () => {
    stored.set(KvKeyUserToken, token('Reader'));
    mountAdmin();
    const logout = await screen.findByRole('link', { name: 'Logout' });
    const release = hold(jsutils.KvDel);
    fireEvent.click(logout);
    expect(await screen.findByRole('alert')).toHaveTextContent('still signed in');
    release();
    expect(await screen.findByRole('button', { name: 'Login' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(stored.has(KvKeyUserToken)).toBe(false);
  });

  it('keeps the signed-in view and the error when sign-out really fails', async () => {
    stored.set(KvKeyUserToken, token('Reader'));
    mountAdmin();
    const logout = await screen.findByRole('link', { name: 'Logout' });
    jsutils.KvDel.mockRejectedValueOnce(new Error('store refused'));
    fireEvent.click(logout);
    expect(await screen.findByRole('alert')).toHaveTextContent('still signed in');
    expect(screen.getByText(/Welcome, Reader/)).toBeInTheDocument();
  });
});

describe('a sign-in whose write outlives its deadline', () => {
  it('leaves no token behind after a first sign-in reported failure', async () => {
    const release = hold(jsutils.KvSet);
    await expect(saveSession(token('New'))).rejects.toThrow();
    release();
    await settle();
    expect(stored.has(KvKeyUserToken)).toBe(false);
  });

  it('ends on the earlier session when the abandoned write settles after the restore', async () => {
    const earlier = token('Earlier');
    stored.set(KvKeyUserToken, earlier);
    const release = hold(jsutils.KvSet);
    await expect(saveSession(token('New'))).rejects.toThrow();
    expect(stored.get(KvKeyUserToken)).toBe(earlier);
    release();
    await settle();
    expect(stored.get(KvKeyUserToken)).toBe(earlier);
  });

  it('never removes a session that a newer sign-in wrote meanwhile', async () => {
    const newer = token('Newer');
    let finishAbandoned;
    jsutils.KvSet.mockImplementationOnce(() => new Promise((resolve) => (finishAbandoned = resolve)));
    await expect(saveSession(token('Abandoned'))).rejects.toThrow();
    stored.set(KvKeyUserToken, newer);
    finishAbandoned();
    await settle();
    expect(stored.get(KvKeyUserToken)).toBe(newer);
  });

  it('keeps a successful sign-in', async () => {
    const session = token('New');
    stored.set(KvKeyAuthUser, { sub: 'legacy' });
    await saveSession(session);
    expect(stored.get(KvKeyUserToken)).toBe(session);
    expect(stored.has(KvKeyAuthUser)).toBe(false);
  });
});

describe('clearing an expired session', () => {
  it('does not delete a token another tab wrote since it was read', async () => {
    const fresh = token('Fresh');
    stored.set(KvKeyUserToken, token('Expired', -60));
    stored.set(KvKeyAuthUser, { sub: 'legacy' });
    jsutils.KvDel.mockImplementationOnce(async (key) => {
      stored.delete(key);
      stored.set(KvKeyUserToken, fresh);
    });
    await getCurrentUsername();
    expect(stored.get(KvKeyUserToken)).toBe(fresh);
  });

  it('still removes an expired token and legacy data', async () => {
    stored.set(KvKeyUserToken, token('Expired', -60));
    stored.set(KvKeyAuthUser, { sub: 'legacy' });
    await expect(getCurrentUsername()).resolves.toBeUndefined();
    expect(stored.has(KvKeyUserToken)).toBe(false);
    expect(stored.has(KvKeyAuthUser)).toBe(false);
  });
});

describe('overlapping writes to one key', () => {
  it('keeps the newer choice when an older write fails afterwards', async () => {
    const subscriber = vi.fn();
    const unsubscribe = kvSubscribe('overlap-a', subscriber);
    let failOlder;
    jsutils.KvSet.mockImplementationOnce(() => new Promise((_resolve, reject) => (failOlder = reject)));
    const older = kvSet('overlap-a', 'older');
    await startWrite();
    expect(failOlder).toBeTypeOf('function');
    await kvSet('overlap-a', 'newer');
    failOlder(new Error('store refused'));
    await older;
    await settle();
    await expect(kvGet('overlap-a')).resolves.toBe('newer');
    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenCalledWith('newer', null);
    unsubscribe();
  });

  it('keeps a newer choice held in memory when an older write succeeds afterwards', async () => {
    let finishOlder;
    jsutils.KvSet.mockImplementationOnce(() => new Promise((resolve) => (finishOlder = resolve)));
    const older = kvSet('overlap-b', 'older');
    await startWrite();
    expect(finishOlder).toBeTypeOf('function');
    jsutils.KvSet.mockRejectedValueOnce(new Error('store refused'));
    await kvSet('overlap-b', 'newer');
    finishOlder();
    await older;
    await expect(kvGet('overlap-b')).resolves.toBe('newer');
  });
});

describe('isHistoryDenial', () => {
  /** failure builds a GraphQL client error carrying one error list. */
  const failure = (errors) => ({ response: { errors } });

  it.each([[[null]], [[undefined]], [[{ message: 42 }]], [[{}]], [['text']], [[{ message: 'post history is not published' }, null]]])(
    'treats the malformed list %j as a failure without throwing',
    (errors) => {
      expect(isHistoryDenial(failure(errors))).toBe(false);
    }
  );

  it('still recognizes a real refusal', () => {
    expect(isHistoryDenial(failure([{ message: 'post history is not published' }]))).toBe(true);
  });
});
