'use strict';

import Cookies from 'js-cookie';


window.Cookies = Cookies;

/** get user language preference from browser
 *
 * @return {string} language code, e.g. 'en', 'zh'
 */
window.getUserLanguage = () => {
    let lang = navigator.language || navigator.userLanguage;
    return lang.split('-')[0];
};
