import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
    formatTs,
    getCurrentPathName,
    isForce,
    ts2UTC
} from '../../library/base';


// Mock dependencies
vi.mock('@laisky/js-utils', () => ({
    default: {
        KvGet: vi.fn(),
        KvSet: vi.fn()
    }
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
            href: 'https://laisky.com/test-path'
        };

        // Mock document.documentElement
        Object.defineProperty(document, 'documentElement', {
            writable: true,
            value: {
                lang: '',
                getAttribute: vi.fn(),
                setAttribute: vi.fn()
            }
        });

        // Mock navigator
        Object.defineProperty(navigator, 'language', {
            writable: true,
            value: 'en-US'
        });

        // Reset mocks
        vi.clearAllMocks();
    });

    afterEach(() => {
        // Restore window.location
        window.location = originalLocation;
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
            expect(ts2UTC(date)).toBe('2023-05-15T12:34Z');
        });
    });
});
