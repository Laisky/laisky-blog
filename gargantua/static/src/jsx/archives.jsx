/**
 * 文章预览页
 */

'use strict';

import React from 'react';

import { BaseComponent } from '../components/base.jsx';
import { ArchiveExtract, ArchiveNav } from '../components/archives.jsx';
import { Notify, Sidebar } from '../components/sidebar.jsx';


class Archives extends BaseComponent {
    constructor(props, context) {
        super(props, context);
        this.state = {
            archives: [],
            hint: '载入中...'
        };
    };

    componentDidMount() {
        this.updatePage.call(this);
    };

    componentWillReceiveProps(nextProps) {
        this.updatePage.call(this, nextProps.params.page);
    };

    updatePage(currentPage=this.props.params.page) {
        let that = this,
            limit = 10,
            skip = (currentPage - 1) * limit;

        $.getJSON({
            url: `/api/v2/post/?limit=${limit}&skip=${skip}`,
            method: 'GET',
            dataType: 'json'
        })
            .done((resp) => {
                that.setState({
                    hint: null,
                    archives: resp.result,
                    totalPage: Math.ceil(resp.total / limit),
                    currentPage: currentPage,
                });
            })
            .fail(() => {
                that.setState({hint: '读取数据失败，请刷新重试'});
            });
    };

    render() {
        let archives = [],
            hintEle;

        if(this.state.hint) {
            hintEle = <p className="hint">{this.state.hint}</p>;
        }

        for(let post of this.state.archives) {
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
                    <Notify text="react 前端重构完成度 80 % ..." />
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
    };
}

export { Archives };
