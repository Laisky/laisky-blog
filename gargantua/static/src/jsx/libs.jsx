'use strict';

import Cookies from 'js-cookie';

window.Cookies = Cookies;

const libs = window.libs;
const KvKeyUserLanguage = "user_language";


/** get user language preference from browser
 *
 * @return {string} language code, e.g. 'en_US', 'zh_CN'
 */
window.getUserLanguage = async () => {
    let url = new URL(window.location.href),
        langSimple;

    // get lang from url parameter
    if (url.searchParams.has('lang')) {
        langSimple = url.searchParams.get('lang');
    }

    // get lang from kv storage
    if (!langSimple) {
        langSimple = await libs.KvGet(KvKeyUserLanguage);
    }

    // get lang from browser
    if (!langSimple) {
        langSimple = navigator.language || navigator.userLanguage;
        langSimple = langSimple.split('-')[0];
    }

    // update kv storage
    if (langSimple) {
        await window.setUserLanguage(langSimple);
    }

    let langBackend;
    switch (langSimple) {
    case 'zh':
        langBackend = 'zh_CN';
        break;
    default:
        langBackend = 'en_US';
    }

    // change html lang
    document.documentElement.lang = langBackend;

    return langBackend;
};

/**
 * set user language preference
 *
 * @param {string} langSimple
 */
window.setUserLanguage = async (langSimple) => {
    try {
        await libs.KvSet(KvKeyUserLanguage, langSimple);
    } catch (e) {
        console.warn(`setUserLanguage: ${e}`);
    }
}
