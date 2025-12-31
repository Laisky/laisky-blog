import jsutils from '@laisky/js-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
    formatTs,
    getCurrentPathName,
    getCurrentUsername,
    isForce,
    isJwtExpired,
    ts2UTC,
} from '../../library/base';

// Mock dependencies
vi.mock('@laisky/js-utils', () => ({
    default: {
        KvGet: vi.fn(),
        KvSet: vi.fn(),
        KvDel: vi.fn(),
    },
}));

describe('base.jsx', () => {
    // Store original window properties
    let originalLocation;

    beforeEach(() => {
        // Save original properties
        originalLocation = window.location;

        // Mock window.location
        delete window.location;
        window.location = {
            pathname: '/test-path',
            search: '',
            href: 'https://laisky.com/test-path',
        };

        // Mock document.documentElement
        Object.defineProperty(document, 'documentElement', {
            writable: true,
            value: {
                lang: '',
                getAttribute: vi.fn(),
                setAttribute: vi.fn(),
            },
        });

        // Mock navigator
        Object.defineProperty(navigator, 'language', {
            writable: true,
            value: 'en-US',
        });

        // Reset mocks
        vi.clearAllMocks();
    });

    afterEach(() => {
        // Restore window.location
        window.location = originalLocation;
    });

    describe('isJwtExpired', () => {
        const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
        const makeToken = (payload) => `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(payload)}.`;

        test('returns true for invalid token', () => {
            expect(isJwtExpired('not.a.token')).toBe(true);
        });

        test('returns true when exp missing', () => {
            const token = makeToken({ sub: 'u1' });
            expect(isJwtExpired(token)).toBe(true);
        });

        test('returns true when token expired', () => {
            const past = Math.floor(Date.now() / 1000) - 60;
            const token = makeToken({ exp: past });
            expect(isJwtExpired(token)).toBe(true);
        });

        test('returns false when token valid (future exp)', () => {
            const future = Math.floor(Date.now() / 1000) + 60;
            const token = makeToken({ exp: future });
            expect(isJwtExpired(token)).toBe(false);
        });
    });

    describe('getCurrentUsername', () => {
        const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
        const makeToken = (payload) => `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(payload)}.`;

        beforeEach(() => {
            vi.clearAllMocks();
        });

        test('returns undefined and clears storage when token missing', async () => {
            jsutils.KvGet.mockResolvedValueOnce(null); // token
            const name = await getCurrentUsername();
            expect(name).toBeUndefined();
        });

        test('returns undefined and clears storage when token expired', async () => {
            const past = Math.floor(Date.now() / 1000) - 10;
            const token = makeToken({ exp: past, display_name: 'User' });
            jsutils.KvGet.mockResolvedValueOnce(token); // token

            const name = await getCurrentUsername();
            expect(name).toBeUndefined();
            expect(jsutils.KvDel).toHaveBeenCalledTimes(2);
        });

        test('decodes token to get username when cache missing and token valid', async () => {
            const future = Math.floor(Date.now() / 1000) + 300;
            const token = makeToken({ exp: future, display_name: 'Alice' });
            jsutils.KvGet.mockResolvedValueOnce(token) // token
                .mockResolvedValueOnce(null); // auth_user missing

            const name = await getCurrentUsername();
            expect(name).toBe('Alice');
            expect(jsutils.KvSet).toHaveBeenCalled();
        });
    });

    describe('isForce', () => {
        test('should return true when force parameter exists in URL', () => {
            window.location.search = '?force=1';
            expect(isForce()).toBe('1');

            window.location.search = '?other=param&force=true';
            expect(isForce()).toBe('true');
        });

        test('should return false when force parameter does not exist in URL', () => {
            window.location.search = '?other=param';
            expect(isForce()).toBeFalsy();
        });
    });

    describe('getCurrentPathName', () => {
        test('should return current pathname', () => {
            window.location.pathname = '/test-page';
            expect(getCurrentPathName()).toBe('/test-page');
        });
    });

    describe('formatTs', () => {
        test('should format timestamp as YYYY-MM-DD', () => {
            const date = new Date('2023-05-15T12:34:56Z');
            expect(formatTs(date)).toBe('2023-05-15');
        });
    });

    describe('ts2UTC', () => {
        test('should format timestamp as UTC string', () => {
            const date = new Date('2023-05-15T12:34:56Z');
            expect(ts2UTC(date)).toBe('2023-05-15T12:34:56Z');
        });
    });
});
