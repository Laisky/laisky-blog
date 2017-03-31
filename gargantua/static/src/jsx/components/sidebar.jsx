/**
 * 关于边栏的各种控制组件
 *
 * 包含：
 *
 *   - Profile
 *   - Tags cloud
 *   - Login
 *   - Notify
 */

'use strict';

import React from 'react';
import { Link } from 'react-router';

import { BaseComponent } from './base.jsx';


export class Notify extends BaseComponent {
    render() {
        let text = this.props.text,
            alertEle;

        if(text) {
            alertEle = <div className="alert alert-warning alert-dismissible" role="alert">
                <button type="button" className="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                <span>{text}</span>
            </div>;
        }

        return (
            alertEle
        );
    };
}


export class Sidebar extends BaseComponent {
    render() {
        return (
            <div className="container-fluid sidebar">
                <Profile />
                <Categories />
                <Login />
                <Tagcloud />
            </div>
        );
    };
}


export class Categories extends BaseComponent {

    componentDidMount() {
        this.loadCategories();
    };

    async loadCategories() {
        let url = '/api/v2/post/category/';
        $.getJSON(url)
            .then(resp => {
                this.setState({categories: resp.result});
            });
    };

    render() {
        let html = [<p><Link to="/cate/">全部</Link></p>];
        if(this.state.categories) {
            for(let cate of this.state.categories) {
                html.push(<p><Link to={{ pathname: `/cate/${cate['_id']}/` }}>{`${cate['name']}`}</Link></p>)
            }
        }

        return (
            <section className="row console categories">
                <h2>类别</h2>
                <div>{html}</div>
            </section>
        );
    };
}


export class Login extends BaseComponent {
    render() {
        let username = this.getCurrentUsername(),
            loginBtn;

        if(username) {
            loginBtn = (
                <div>
                    <p><Link to={{ pathname: '/publish/' }}>发布</Link></p>
                    <p><Link to={{ pathname: '/admin/' }}>管理</Link></p>
                    <p><a className="btn">注销</a></p>
                </div>
            );
        }else {
            loginBtn = <Link to={{ pathname: '/login/' }}>登陆</Link>
        }
        return (
            <section className="row console login">
                <h2>登录管理</h2>
                {loginBtn}
            </section>
        );
    };
}


export class Profile extends BaseComponent {
    render() {
        return (
            <section className="row console profile">
                <h2>个人介绍</h2>
                <p>Lasiky</p>
                <p>Email: me@laisky.com</p>
                <p>Twitter: @ppcelery</p>
            </section>
        );
    };
}


export class Tagcloud extends BaseComponent {
    render() {
        return (
            <section className="row console tag">
                <h2>标签云</h2>
                <p>摸鱼被发现了，还没做……</p>
            </section>
        );
    };
}

