'use strict';

import React from 'react';

export const KvKeyLanguage = 'language';
const $ = window.$;

class BaseComponent extends React.Component {
    constructor(props, context) {
        super(props, context);
        this.state = {};
    }

    getCurrentPathName() {
        return this.context.router.getCurrentPathname();
    }

    getCurrentRoute() {
        return this.props.routes[this.props.routes.length - 1];
    }

    getCurrentRouteName() {
        return this.props.routes[this.props.routes.length - 1].name;
    }

    addXSRF(data) {
        return Object.assign({}, { '_xsrf': $.cookie('_xsrf') }, data);
    }

    getCurrentUsername() {
        let token = $.cookie('token'),
            userinfo;

        try {
            userinfo = window.jwt_decode(token);
            return userinfo["display_name"];
        } catch (e) {
            return;
        }
    }

    getCurrentUID() {
        let token = $.cookie('token'),
            userinfo;

        try {
            userinfo = window.jwt_decode(token);
            return userinfo['uid'];
        } catch (e) {
            return;
        }
    }

    componentWillMount() {
        this.intervals = [];
    }

    setInterval(...args) {
        this.intervals.push(setInterval.apply(null, args));
    }

    componentWillUnmount() {
        this.intervals.map(clearInterval);
    }

    formatTs(ts) {
        return window.moment(Number.parseInt(ts) * 1000).format('YYYY/MM/DD HH:MM');
    }

}


export { BaseComponent };
