'use strict';

import { jwtDecode } from "jwt-decode";
import moment from 'moment';

import { KvGet, KvSet } from './libs.js';

export const GraphqlAPI = 'https://gq.laisky.com/query/';

export const KvKeyLanguage = 'language';
export const KvKeyAuthUser = 'auth_user';
export const KvKeyPrefixCache = '@cache_';

export const DurationDay = 24 * 60 * 60 * 1000;
export const DurationWeek = 7 * DurationDay;

// /**
//  * Get the cookie value by name.
//  *
//  * @returns {string} The cookie value.
//  */
// export const getCookie = (name) => {
//     const value = `; ${document.cookie}`;
//     const parts = value.split(`; ${name}=`);
//     if (parts.length === 2) return parts.pop().split(';').shift();
// }

export const getGraphqlAPI = () => {
    if (typeof window !== 'undefined' && window.location) {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('force')) {
            return `${GraphqlAPI}?force=1`;
        }
    }

    return GraphqlAPI;
};


export const getCurrentPathName = () => {
    return location.pathname;
};

/**
 * Get the current username.
 *
 * @returns {string|null} The username or null if not available.
 */
export const getCurrentUsername = async () => {
    let userinfo =  await KvGet(KvKeyAuthUser);
    if (!userinfo) {
        return;
    }

    return userinfo['display_name'];
};


export const setUserLanguage = async (lang) => {
    console.debug(`setUserLanguage: ${lang}`);
    try {
        await KvSet(KvKeyLanguage, lang);
    } catch (e) {
        console.warn(`setUserLanguage: ${e}`);
    }
};

export const getUserLanguage = async () => {
    let url = new URL(window.location.href),
        lang;

    // get lang from url parameter
    if (url.searchParams.has('lang')) {
        lang = url.searchParams.get('lang');
    }

    // get lang from kv storage
    if (!lang) {
        lang = await KvGet(KvKeyLanguage);
    }

    // get lang from browser
    if (!lang) {
        lang = navigator.language || navigator.userLanguage;
    }

    switch (lang) {
        case 'zh':
        case 'zh_CN':
            lang = 'zh_CN';
            break;
        default:
            lang = 'en_US';
    }

    // change html lang
    document.documentElement.lang = lang;

    return lang;
};


export const formatTs = (ts) => {
    return moment(ts).format('YYYY-MM-DD');
}

export const ts2UTC = (ts) => {
    return moment(ts).utc().format('YYYY-MM-DDTHH:MM[Z]');
}
