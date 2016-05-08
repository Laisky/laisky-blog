'use strict';

import React from 'react';


class BaseComponent extends React.Component {
    getCurrentPathName() {
        return this.context.router.getCurrentPathname();
    };

    getCurrentRoute() {
        return this.props.routes[this.props.routes.length-1];
    };

    getCurrentRouteName() {
        return this.props.routes[this.props.routes.length-1].name;
    };

    getCurrentUsername() {
        return $.cookie('username') || '';
    };

    componentWillMount() {
        this.intervals = [];
    };

    setInterval(...args) {
        this.intervals.push(setInterval.apply(null, args));
    };

    componentWillUnmount() {
        this.intervals.map(clearInterval);
    };

    formatTs(ts) {
        return moment(Number.parseInt(ts) * 1000).format('YYYY/MM/DD HH:MM');
    }

}


export { BaseComponent };
