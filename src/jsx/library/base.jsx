'use strict';

import { jwtDecode } from "jwt-decode";
import moment from 'moment';
import jsutils from '@laisky/js-utils';
import request, { GraphQLClient } from "graphql-request";
import { isJsxFragment } from "typescript";

export const GraphqlAPI = 'https://gq.laisky.com/query/';
// export const GraphqlAPI = 'http://100.75.198.70:18080/query/';

export const KvKeyLanguage = 'language';
export const KvKeyUserToken = 'user_token';
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

/**
 * Get the current user token.
 *
 * @param {string} body - The graphql query body.
 * @param {object} vars - The graphql query variables.
 * @param {object} headers - The graphql query headers.
 *
 */
export const graphqlQuery = async (body, vars, headers) => {
    const client = new GraphQLClient(getGraphqlAPI(), {
        method: 'GET',
    });

    if (isForce()) {
        // disable cache
        headers = headers || {};
        headers['Cache-Control'] = 'no-cache';
    }

    return await client.request(body, vars, headers);
}

/**
 * Get the current user token.
 *
 * @param {string} body - The graphql mutation body.
 * @param {object} vars - The graphql mutation variables.
 * @param {object} headers - The graphql mutation headers.
 */
export const graphqlMutation = async (body, vars, headers) => {
    return await request(getGraphqlAPI(), body, vars, headers);
}

export const isForce = () => {
    if (typeof window !== 'undefined' && window.location) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('force');
    }

    return false;
}

export const getGraphqlAPI = () => {
    if (isForce()) {
        return `${GraphqlAPI}?force=1`;
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
    let userinfo = await jsutils.KvGet(KvKeyAuthUser);
    if (!userinfo) {
        return;
    }

    return userinfo['display_name'];
};


/**
 * Set the user language.
 *
 * @param {string} lang - The user language.
 */
export const setUserLanguage = async (lang) => {
    console.debug(`setUserLanguage: ${lang}`);
    try {
        await jsutils.KvSet(KvKeyLanguage, lang);
    } catch (e) {
        console.warn(`setUserLanguage: ${e}`);
    }
};

/**
 * Get the current user language.
 * Supports detecting language by prefix to handle variants like "zh-Hans-CN".
 *
 * @returns {string} The normalized user language code (either "zh_CN" or "en_US")
 */
export const getUserLanguage = async () => {
    // Get language from the URL parameter, kv storage, or browser settings in that order
    const url = new URL(window.location.href);
    let lang = url.searchParams.get('lang')
        // || await jsutils.KvGet(KvKeyLanguage)
        || (navigator.language || navigator.userLanguage);

    // Convert to lowercase for consistent comparison
    const langLower = lang ? lang.toLowerCase() : '';

    // Normalize language: treat any Chinese variant as 'zh_CN', all others as 'en_US'
    // This handles variants like zh-Hans-CN, zh-TW, zh-HK, etc.
    const normalizedLang = langLower.startsWith('zh') ? 'zh_CN' : 'en_US';

    // Update the html document language attribute with the normalized code
    document.documentElement.lang = normalizedLang;

    // Persist the language setting, and warn if it fails
    try {
        await setUserLanguage(normalizedLang);
    } catch (error) {
        console.warn(`setUserLanguage failed: ${error}`);
    }

    return normalizedLang;
};

export const formatTs = (ts) => {
    return moment(ts).format('YYYY-MM-DD');
}

export const ts2UTC = (ts) => {
    return moment(ts).utc().format('YYYY-MM-DDTHH:mm[Z]');
}
