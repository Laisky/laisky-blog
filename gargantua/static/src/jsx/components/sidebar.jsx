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
            BlogPostCategories {
                name
                url
            }
        }`);
        this.setState({categories: resp.BlogPostCategories});
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
                <h2>Categories</h2>
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
            loginBtn = <Link to={{ pathname: '/login/' }}>Login</Link>
        }
        return (
            <section className="row console login">
                <h2>Admin</h2>
                {loginBtn}
            </section>
        );
    }
}


export class Profile extends BaseComponent {
    render() {
        return (
            <section className="row console profile">
                <h2>Profile</h2>
                <p>Laisky</p>
                <p>Email: <img style={{width: '70%'}} src="https://s1.laisky.com/images/laisky-email.png" alt="email"/></p>
                <p><label>GitHub: </label><a href="https://github.com/Laisky" target="_blank">@Laisky</a></p>
                <p><label>Threads: </label><a href="https://www.threads.net/@laiskycai" target="_blank">Laisky Cai</a></p>
                <p><label>FaceBook: </label><a href="https://www.facebook.com/LaiskyCai" target="_blank">Laisky Cai</a></p>
            </section>
        );
    }
}


export class Tagcloud extends BaseComponent {
    componentDidMount() {
        this.loadTags();
    }

    async loadTags() {
        const resp = await request(window.graphqlAPI, `query {
            BlogTags
        }`);

        let html = [];
        resp.BlogTags.map(tag => {
            html.push(<span onClick={this.getTagClickHandler()} className="label label-info">{`${tag}`}</span>);
        });
        this.setState({tags: html});
    }

    getTagClickHandler() {
        return evt => {
            if (!google || !google.search.cse.element.getElement('post_search')) return;

            let query = evt.target.innerText;
            google.search.cse.element.getElement('post_search').execute(query);

            return false;
        };
    }

    render() {
        return (
            <section className="row console tag">
                <h2>Tags</h2>
                <div className="tag-labels">
                    {this.state.tags}
                </div>
            </section>
        );
    }
}
