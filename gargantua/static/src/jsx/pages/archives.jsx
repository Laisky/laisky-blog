/**
 * 文章预览页
 */

'use strict';

import React from 'react';

import { ArchiveExtract, ArchiveNav } from '../components/archives.jsx';
import { Notify, Sidebar } from '../components/sidebar.jsx';
import { BaseComponent } from '../components/base.jsx';
import { request } from 'graphql-request';


class ArchivesCache {

    constructor() {
        this.limit = 10;
    }

    convertPage2Skip(nPage) {
        return (nPage - 1) * this.limit;
    }

    // 从缓存中取数据
    async getByPage(nPage) {
        let resp,
            _pContent = window.sessionStorage.getItem(`page-${nPage}`);

        if (_pContent && window.location.search.indexOf('force') < 0) {
            resp = JSON.parse(_pContent);
        } else {
            resp = await this.loadByPage(nPage);
        }

        return resp;
    }

    saveByPage(nPage, obj) {
        let _obj = JSON.stringify(obj);
        window.sessionStorage.setItem(`page-${nPage}`, _obj);
    }

    async loadByPage(nPage) {
        let language = window.getUserLanguage();
        let postsReq = request(window.graphqlAPI, `query {
            BlogPosts(
                length: 200,
                page: {size: ${this.limit}, page: ${nPage - 1}},
                language: ${language}
            ) {
                title
                name
                markdown
                created_at
            }
        }`),
            postInfoReq = request(window.graphqlAPI, `query {
                BlogPostInfo {
                    total
                }
        }`);

        let posts = await postsReq,
            postinfo = await postInfoReq;

        let resp = {
            total: postinfo.BlogPostInfo.total,
            result: [],
        };

        for (let post of posts.BlogPosts) {
            resp.result.push({
                post_name: post.name,
                post_title: post.title,
                post_created_at: post.created_at,
                post_content: post.markdown,
            });
        }

        this.saveByPage(nPage, resp);
        return resp;
    }
}


class Archives extends BaseComponent {
    constructor(props, context) {
        super(props, context);
        this.state = {
            archives: [],
            hint: '载入中...'
        };
        this.archiveCache = new ArchivesCache();
    }

    componentDidMount() {
        this.updatePage();
    }

    componentWillReceiveProps(nextProps) {
        this.updatePage(nextProps.params.page);
    }

    updateArchiveCache(currentPage) {
        for (let i = Math.max(1, currentPage - 2); i <= currentPage + 2; i++) {
            this.archiveCache.getByPage(i);
        }
    }

    updatePage(currentPage = this.props.params.page) {
        let limit = 10,
            nPage = Number.parseInt(currentPage, 10);

        this.updateArchiveCache(nPage);
        this.archiveCache.getByPage(nPage)
            .then(resp => {
                document.title = 'laisky-blog - p' + nPage;
                this.setState({
                    hint: null,
                    archives: resp.result,
                    totalPage: Math.ceil(resp.total / limit),
                    currentPage: nPage
                });
            })
            .catch(e => {
                this.setState({ hint: `读取数据失败，请刷新重试: ${e}` });
            });
    }

    render() {
        let archives = [],
            hintEle;

        if (this.state.hint) {
            hintEle = <p className="hint">{this.state.hint}</p>;
        }

        for (let post of this.state.archives) {
            archives.push(
                <ArchiveExtract key={post.post_name}
                    archive-name={post.post_name}
                    archive-title={post.post_title}
                    archive-created-at={post.post_created_at}
                    archive-content={post.post_content} />
            );
        }

        return (
            <div id="archives" className="archives-body container-fluid">
                <div className="row">
                    {/* <Notify text="全站启用 HTTPS & HTTPv2.0" /> */}
                </div>
                <div className="row">
                    <div id="archive-content" className="col-sm-9 col-xs-12">
                        {hintEle}
                        {archives}
                    </div>
                    <div id="archive-sidebar" className="col-sm-3 navigator hidden-xs">
                        <Sidebar />
                    </div>
                </div>
                <div className="row">
                    <ArchiveNav currentPage={this.state.currentPage}
                        totalPage={this.state.totalPage} />
                </div>
            </div>
        );
    }
}

export { Archives };
