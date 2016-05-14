/**
 * 文章发布页
 */

'use strict';

import React from 'react';

import { BaseComponent } from './components/base.jsx';


class BaseEditComponent extends BaseComponent {
    constructor(props, context) {
        super(props, context);
        this.state = {
            post: null,
            hint: this.props.hint || '',
            action: this.props.action,
            method: this.props.method || 'POST',
            post_name: this.props.post_name || '',
            post_title: this.props.post_title || '',
            post_markdown: this.props.post_markdown || '',
            post_content: this.props.post_content || '',
            post_type: this.props.post_type || ''
        };
    };

    componentDidMount() {
        if(!$.cookie('uid')) location.href = '/archives/1/';

        if(this.props.getInitData) {
            this.props.getInitData.call(this)
        }
    };

    getHandleSubmit() {
        let that = this;

        return (evt) => {
            evt.preventDefault();

            let formData = {
                _xsrf: $.cookie('_xsrf'),
                postTitle: that.refs.postTitle.value,
                postName: that.refs.postName.value,
                postContent: that.refs.postContent.value,
                postType: that.refs.postType.value
            };

            $.ajax({
                url: that.state.action,
                method: that.state.method,
                data: formData
            })
                .done((resp) => {
                    that.setState({hint: '发布成功，等待跳转'});
                    setTimeout(() => {
                        location.href = `/p/${formData.postName}/`;
                    }, 4000);
                })
                .fail((resp) => {
                    that.setState({hint: resp.responseText});
                });
        };
    };

    render() {
        return (
            <div className="container-fluid publish-body">
                <div className="row hint">
                    <span ref="hint" className="label label-info">{this.state.hint}</span>
                </div>
                <form id="publishForm" action={this.state.action} method={this.state.method} className="row" >
                    <div className="form-group">
                        <label for="post_title">文章标题</label>
                        <input type="text" className="form-control" ref="postTitle" placeholder="文章标题" name="postTitle" />
                    </div>
                    <div className="form-group">
                        <label for="post_name">文章链接</label>
                        <input type="text" name="postName" className="form-control" ref="postName" placeholder="文章链接 'one-more-tineone-more-chance'" value={this.state.post_name} />
                    </div>
                    <div className="form-group">
                        <label for="post_content">文章内容</label>
                        <textarea className="form-control" name="postContent" rows="20" placeholder="文章内容" ref="postContent"></textarea>
                    </div>
                    <div className="form-group">
                        <label for="post_type">文章类型</label>
                        <select className="form-control" ref="postType" name="postType" >
                            <option value="markdown">markdown</option>
                            <option value="slide">slide</option>
                        </select>
                    </div>
                    <input type="text" hidden="true" value={this.state.post_id} />
                    <button type="submit" onClick={this.getHandleSubmit()} className="btn btn-default">Submit</button>
                </form>
            </div>
        );
    };
}


class Publish extends BaseComponent {
    render() {
        return (
            <div id="publish">
                <BaseEditComponent action="/api/posts/publish/"
                                   hint="发布新文章" />
            </div>

        );
    };
}


class Amend extends BaseComponent {
    getInitData() {
        let that = this;

        $.ajax({
            url: `/api/v2/post/${this.props.params.pid}/`,
            method: 'GET',
            dataType: 'json'
        })
            .done((resp) => {
                that.setState({
                    post_name: resp.result.post_name,
                    hint: '编辑文章'
                });
                $(that.refs.postTitle).val(resp.result.post_title);
                $(that.refs.postContent).val(resp.result.post_markdown);
                $(that.refs.postType).val(resp.result.post_type);
            })
            .fail((resp) => {
                that.setState({hint: '加载失败，请刷新重试...'})
            });
    };

    render() {
        return (
            <div id="amend">
                <BaseEditComponent action="/api/posts/amend/"
                                   method="PATCH"
                                   hint='等待加载...'
                                   params={this.props.params}
                                   getInitData={this.getInitData} />
            </div>
        );
    };
}


export { Publish, Amend };
