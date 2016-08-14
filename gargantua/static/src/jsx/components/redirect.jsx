'use strict';

import React from 'react';
import { browserHistory } from 'react-router';

import { BaseComponent } from './base.jsx';


/**
 * 重定向组件，
 * @param title  提示
 * @param waitSec  等待秒数
 * @param nextUrl  跳转的地址
 * @param nextDataUrl  动态加载的地址
 * @param targetSelector  动态加载填充的目标
 */
class Redirect extends BaseComponent{
    constructor(props, context) {
        super(props, context);
        let waitSec = Number.parseInt(this.props.waitSec, 10);
        this.state = {waitSec: waitSec};
    };

    componentDidMount() {
        this.setInterval(this.setTick(), 1000);

        // preload data
        let url = this.props.nextDataUrl;

        $.get(url, {'ajax': 'body'}, (data) => {})
            .done((data) => {
                this.nextPageData = data;
            });
    };

    setTick() {
        return () => {
            if(this.state.waitSec > 0) {
                this.setState({waitSec: this.state.waitSec - 1});
            } else {
                if(this.nextPageData){
                    browserHistory.push(this.props.nextUrl);
                    $(this.props.targetSelector).html(this.nextPageData);
                } else {
                    setTimeout(() => {this.tick();}, 200);
                }
            }
        }
    };

    render() {
        return <div className="redirectComponent">
            <h1>{this.props.title}</h1>
            <p><span className="count">{this.state.waitSec}</span> 秒 后将自动跳转</p>
        </div>
    };
}


export { Redirect };
