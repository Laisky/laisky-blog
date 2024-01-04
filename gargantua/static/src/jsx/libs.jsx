'use strict';

import Cookies from 'js-cookie';


window.Cookies = Cookies;

/** get user language preference from browser
 *
 * @return {string} language code, e.g. 'en_US', 'zh_CN'
 */
window.getUserLanguage = () => {
    let url = new URL(window.location.href),
        langSimple;
    if (url.searchParams.has('lang')) {
        langSimple = url.searchParams.get('lang');
    } else {
        langSimple = navigator.language || navigator.userLanguage;
        langSimple = langSimple.split('-')[0];
    }

    let langBackend;
    switch (langSimple) {
        case 'zh':
            langBackend = 'zh_CN';
            break;
        default:
            langBackend = 'en_US';
    }

    // if lang not in url parameter, add it
    if (!url.searchParams.has('lang')) {
        url.searchParams.set('lang', langSimple);
        window.history.replaceState({}, '', url.toString());
    }

    return langBackend;
};
