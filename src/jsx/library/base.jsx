'use strict';

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { jwtDecode } from "jwt-decode";
import * as libs from './libs';

export const KvKeyLanguage = 'language';
const $ = window.$;

export const useBaseComponent = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [intervals, setIntervals] = React.useState([]);

    const getCurrentPathName = () => {
        return location.pathname;
    };


    /**
     * Get the current username.
     *
     * @returns {string|null} The username or null if not available.
     */
    const getCurrentUsername = () => {
        let token = $.cookie('token'),
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
    const getCurrentUID = () => {
        let token = $.cookie('token'),
            userinfo;

        try {
            userinfo = window.jwt_decode(token);
            return userinfo['uid'];
        } catch (e) {
            console.warn(`getCurrentUID: ${e}`);
            return;
        }
    };

    const setUserLanguage = async (langSimple) => {
        try {
            await libs.KvSet(KvKeyLanguage, langSimple);
        } catch (e) {
            console.warn(`setUserLanguage: ${e}`);
        }
    };

    const getUserLanguage = async () => {
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

    React.useEffect(() => {
        return () => {
            intervals.forEach(clearInterval);
        };
    }, [intervals]);

    const setIntervalCustom = (...args) => {
        const intervalId = setInterval(...args);
        setIntervals([...intervals, intervalId]);
    };

    const formatTs = (ts) => {
        return window.moment(Number.parseInt(ts) * 1000).format('YYYY/MM/DD HH:MM');
    };

    return {
        getCurrentPathName,
        getCurrentUsername,
        getUserLanguage,
        setUserLanguage,
        getCurrentUID,
        setIntervalCustom,
        formatTs,
        navigate
    };
};
