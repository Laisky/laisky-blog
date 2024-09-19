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

export const setUserLanguage = async (langSimple) => {
    try {
        await libs.KvSet(KvKeyLanguage, langSimple);
    } catch (e) {
        console.warn(`setUserLanguage: ${e}`);
    }
};

export const getUserLanguage = async () => {
    let url = new URL(window.location.href),
        langSimple;

    // get lang from url parameter
    if (url.searchParams.has('lang')) {
        langSimple = url.searchParams.get('lang');
    }

    // get lang from kv storage
    if (!langSimple) {
        langSimple = await libs.KvGet(KvKeyLanguage);
    }

    // get lang from browser
    if (!langSimple) {
        langSimple = navigator.language || navigator.userLanguage;
        langSimple = langSimple.split('-')[0];
    }

    // update kv storage
    if (langSimple) {
        await setUserLanguage(langSimple);
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

export const formatTs = (ts) => {
    return moment(Number.parseInt(ts) * 1000).format('YYYY/MM/DD HH:MM');
};
