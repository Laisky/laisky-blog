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
import { request } from 'graphql-request';


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
    }
}


export class Sidebar extends BaseComponent {
    render() {
        return (
            <div className="container-fluid sidebar">
                {/* <Profile /> */}
                <Categories />
                <Login />
                <Tagcloud />
            </div>
        );
    }
}


export class Categories extends BaseComponent {

    componentDidMount() {
        this.loadCategories();
    }

    async loadCategories() {
        let resp = await request(window.graphqlAPI, `query {
            post_categories {
                name
                url
            }
        }`);
        this.setState({categories: resp.post_categories});
    }

    render() {
        let html = [<p><Link to="/cate/">全部</Link></p>];
        if(this.state.categories) {
            for(let cate of this.state.categories) {
                html.push(<p><Link to={{ pathname: `/cate/${cate.url}/` }}>{`${cate.name}`}</Link></p>);
            }
        }

        return (
            <section className="row console categories">
                <h2>分类</h2>
                <div>{html}</div>
            </section>
        );
    }
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
            loginBtn = <Link to={{ pathname: '/login/' }}>登录</Link>
        }
        return (
            <section className="row console login">
                <h2>登录管理</h2>
                {loginBtn}
            </section>
        );
    }
}


export class Profile extends BaseComponent {
    render() {
        return (
            <section className="row console profile">
                <h2>个人介绍</h2>
                <p>Laisky</p>
                <p>Email: <img style={{width: '70%'}} src="https://s1.laisky.com/images/laisky-email.png" alt="email"/></p>
                <p><label>Twitter: </label><a href="https://twitter.com/ppcelery" target="_blank">@ppcelery</a></p>
                <p><label>Douban: </label><a href="https://www.douban.com/people/Laisky/" target="_blank">@Laisky</a></p>
                <p><label>GitHub: </label><a href="https://github.com/Laisky" target="_blank">@Laisky</a></p>
            </section>
        );
    }
}


export class Tagcloud extends BaseComponent {
    componentDidMount() {
        this.loadTags();
    }

    async loadTags() {
        let url = '/api/posts/keywords/',
            html = [];

        $.getJSON(url)
            .then(resp => {
                resp.data.map(tag => html.push(<span onClick={this.getTagClickHandler()} className="label label-info">{`${tag}`}</span>));
                this.setState({tags: html});
            });
    }

    getTagClickHandler() {
        return evt => {
            if (!google || !google.search.cse.element.getElement('post_search')) return;

            let query = $(evt.target).text();
            google.search.cse.element.getElement('post_search').execute(query);

            return false;
        };
    }

    render() {
        return (
            <section className="row console tag">
                <h2>标签</h2>
                <div className="tag-labels">
                    {this.state.tags}
                </div>
            </section>
        );
    }
}

