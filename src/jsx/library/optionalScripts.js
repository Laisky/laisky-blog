import { runAsyncWork } from './asyncWork.js';

const SCRIPT_URLS = Object.freeze({
  analytics: 'https://www.googletagmanager.com/gtag/js?id=G-BVS991NWWS',
  search: 'https://cse.google.com/cse.js?cx=004733495569415005684:-c6y46kjqva',
});

/** loadOptionalScript independently loads one allowlisted feature and owns its handlers, deadline and safe failure identity. */
export async function loadOptionalScript(feature, options) {
  if (!Object.prototype.hasOwnProperty.call(SCRIPT_URLS, feature)) throw new Error('Unknown optional feature');
  let script;
  let loaded = false;
  try {
    await runAsyncWork(
      () =>
        new Promise((resolve, reject) => {
          script = document.createElement('script');
          script.src = SCRIPT_URLS[feature];
          script.type = 'text/javascript';
          // These independent features must not enter the ordered dynamic-script queue.
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Optional script resource failed'));
          document.head.appendChild(script);
        }),
      options
    );
    loaded = true;
  } catch (error) {
    const stage = error?.name === 'AbortError' ? 'canceled' : error?.name === 'TimeoutError' ? 'timeout' : 'load';
    const failure = new Error(`${feature} script load failed (${stage})`);
    failure.name = 'OptionalFeatureError';
    failure.feature = feature;
    failure.stage = stage;
    throw failure;
  } finally {
    if (script) {
      script.onload = null;
      script.onerror = null;
      // Retire failed consumers without claiming to undo already executed third-party code.
      if (!loaded) script.remove();
    }
  }
}
