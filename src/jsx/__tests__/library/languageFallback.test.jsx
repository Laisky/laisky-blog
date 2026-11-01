import jsutils from '@laisky/js-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getUserLanguage } from '../../library/base.jsx';

vi.mock('@laisky/js-utils', () => ({
  default: { KvGet: vi.fn(async () => null), KvSet: vi.fn(async () => {}), KvDel: vi.fn(async () => {}) },
}));

/** browserLanguage makes the browser report one language. */
const browserLanguage = (language) => vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(language);

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState({}, '', '/');
  jsutils.KvGet.mockReset();
  jsutils.KvGet.mockResolvedValue(null);
});

describe('a browser language', () => {
  it.each(['zh', 'zh-CN', 'zh-TW', 'zh-HK', 'zh-MO', 'zh-SG', 'zh-Hans', 'zh-Hant', 'zh-Hans-CN', 'zh-Hant-TW', 'ZH-cn', 'zh_CN', 'zh_TW'])(
    '%s is served as Chinese',
    async (language) => {
      browserLanguage(language);
      expect(await getUserLanguage()).toBe('zh_CN');
      expect(document.documentElement.lang).toBe('zh-CN');
    }
  );

  it.each([
    'fr',
    'fr-FR',
    'de-DE',
    'ja-JP',
    'ko-KR',
    'es-419',
    'ar-SA',
    'ru',
    'pt-BR',
    'en',
    'en-GB',
    '',
    'und',
    'xx-Unknown',
    'not a language',
  ])('%s falls back to English', async (language) => {
    browserLanguage(language);
    expect(await getUserLanguage()).toBe('en_US');
    expect(document.documentElement.lang).toBe('en-US');
  });

  it.each(['zha', 'zha-CN', 'zhx-Nshu', 'zhabc', 'zhong', 'zu'])(
    '%s only resembles Chinese, so it falls back to English',
    async (language) => {
      browserLanguage(language);
      expect(await getUserLanguage()).toBe('en_US');
    }
  );
});

describe('a URL language', () => {
  it.each(['fr', 'xx', '123', '<script>', 'en_XX', 'zha', 'zhabc'])(
    '?lang=%s falls back to English, even for a Chinese browser',
    async (language) => {
      browserLanguage('zh-TW');
      window.history.replaceState({}, '', `/?lang=${encodeURIComponent(language)}`);
      expect(await getUserLanguage()).toBe('en_US');
    }
  );

  it('a Chinese parameter still selects Chinese', async () => {
    browserLanguage('fr-FR');
    window.history.replaceState({}, '', '/?lang=zh-TW');
    expect(await getUserLanguage()).toBe('zh_CN');
  });
});

describe('a stored language', () => {
  it.each([['fr-FR'], ['unknown'], [123], [true], [{ language: 'zh_CN' }], [['zh_CN']]])(
    '%j falls back to English without failing',
    async (stored) => {
      browserLanguage('zh-TW');
      jsutils.KvGet.mockResolvedValue(stored);
      await expect(getUserLanguage()).resolves.toBe('en_US');
    }
  );

  it.each(['zh_CN', 'en_US'])('%s is kept', async (stored) => {
    browserLanguage('fr-FR');
    jsutils.KvGet.mockResolvedValue(stored);
    await expect(getUserLanguage()).resolves.toBe(stored);
  });
});
