import jsutils from '@laisky/js-utils';
import { runAsyncWork } from './asyncWork.js';

const SCRIPT_URLS = Object.freeze({
  analytics: 'https://www.googletagmanager.com/gtag/js?id=G-BVS991NWWS',
  search: 'https://cse.google.com/cse.js?cx=004733495569415005684:-c6y46kjqva',
});

/** loadOptionalScript loads one allowlisted feature and replaces unsafe DOM rejections with static diagnostic identity. */
export async function loadOptionalScript(feature, options) {
  if (!Object.prototype.hasOwnProperty.call(SCRIPT_URLS, feature)) throw new Error('Unknown optional feature');
  try {
    await runAsyncWork(() => jsutils.LoadJsModules([SCRIPT_URLS[feature]]), options);
  } catch (error) {
    const stage = error?.name === 'AbortError' ? 'canceled' : error?.name === 'TimeoutError' ? 'timeout' : 'load';
    const failure = new Error(`${feature} script load failed (${stage})`);
    failure.name = 'OptionalFeatureError';
    failure.feature = feature;
    failure.stage = stage;
    throw failure;
  }
}
