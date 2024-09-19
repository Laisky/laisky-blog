'use strict';

import { jwtDecode } from "jwt-decode";
import moment from 'moment';

import * as libs from './libs';

export const KvKeyLanguage = 'language';
export const GraphqlAPI = 'https://gq.laisky.com/query/';


/**
 * Get the cookie value by name.
 *
 * @returns {string} The cookie value.
 */
export const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}


export const getCurrentPathName = () => {
    return location.pathname;
};

/**
 * Get the current username.
 *
 * @returns {string|null} The username or null if not available.
 */
export const getCurrentUsername = () => {
    let token = getCookie('token'),
    userinfo;

    try {
        userinfo = jwtDecode(token);
        return userinfo["display_name"];
    } catch (e) {
        console.warn(`getCurrentUsername: ${e}`);
        return;
    }
};

/**
 * Get the current user ID.
 *
 * @returns {string|null} The user ID or null if not available.
 */
export const getCurrentUID = () => {
    let token = getCookie('token'),
        userinfo;

    try {
        userinfo = jwtDecode(token);
        return userinfo['uid'];
    } catch (e) {
        console.warn(`getCurrentUID: ${e}`);
        return;
    }
};

export const setUserLanguage = async (lang) => {
    try {
        await libs.KvSet(KvKeyLanguage, lang);
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
        lang = await libs.KvGet(KvKeyLanguage);
    }

    // get lang from browser
    if (!lang) {
        lang = navigator.language || navigator.userLanguage;
    }

    // update kv storage
    if (lang) {
        await setUserLanguage(lang);
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
    return moment(Number.parseInt(ts) * 1000).format('YYYY/MM/DD HH:MM');
};
