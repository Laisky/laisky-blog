/**
 * 文章发布页
 */

'use strict';

import React from 'react';

import { BaseComponent } from '../components/base.jsx';
import { request } from 'graphql-request';


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
        console.log("method", this.props.method);
    }

    componentDidMount() {
        if (!this.getCurrentUsername()) location.href = '/archives/1/';

        if (this.props.getInitData) {
            this.props.getInitData.call(this)
        }
    };

    getHandleSubmit() {
        return (evt) => {
            evt.preventDefault();

            let formData = {
                    _xsrf: $.cookie('_xsrf'),
                    postTitle: this.refs.postTitle.value,
                    postName: this.refs.postName.value,
                    postContent: this.refs.postContent.value,
                    postType: this.refs.postType.value
                },
                req,
                variables;

            if (formData.postType == 'markdown') {
                switch (this.state.method) {
                case 'POST':
                    variables = {
                        post: {
                            title: this.refs.postTitle.value,
                            name: this.refs.postName.value,
                            markdown: this.refs.postContent.value,
                            type: this.refs.postType.value,
                        },
                    };
                    req = request(this.state.action, `mutation($post: NewBlogPost!) {
                            createBlogPost(
                                post: $post,
                            ) {
                                name
                            }
                        }`, variables);
                    break;
                case 'PATCH':
                    variables = {
                        post: {
                            title: this.refs.postTitle.value,
                            name: this.refs.postName.value,
                            markdown: this.refs.postContent.value,
                            type: this.refs.postType.value,
                        },
                    };
                    req = request(this.state.action, `mutation($post: NewBlogPost!) {
                        amendBlogPost(
                            post: $post,
                        ) {
                            name
                        }
                    }`, variables);
                    break;
                }
            } else {  // for slide
                req = fetch(this.state.action, {
                    method: this.state.method,
                    body: JSON.stringify(formData),
                });
            }

            req.then((resp) => {
                this.setState({ hint: '发布成功，等待跳转' });
                setTimeout(() => {
                    location.href = `/p/${formData.postName}/`;
                }, 4000);
            })
                .catch((err) => {
                    this.setState({ hint: err.message });
                });
        };
    };

    render() {
        let postName;

        if (this.props.isLinkEditable) {
            postName = <input type="text" name="postName" className="form-control" ref="postName" placeholder="文章链接 'one-more-tineone-more-chance'" defaultValue={this.state.post_name} />
        } else {
            postName = <input type="text" name="postName" className="form-control" ref="postName" placeholder="文章链接 'one-more-tineone-more-chance'" value={this.state.post_name} />
        }

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
                        {postName}
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
                <BaseEditComponent
                    action={window.graphqlAPI}
                    isLinkEditable={true}
                    hint="发布新文章" />
            </div>

        );
    };
}


class Amend extends BaseComponent {
    getInitData() {
        $.ajax({
            url: `/api/v2/post/${this.props.params.pid}/`,
            method: 'GET',
            dataType: 'json'
        })
            .done((resp) => {
                this.setState({
                    post_name: resp.result.post_name,
                    hint: '编辑文章'
                });
                $(this.refs.postTitle).val(resp.result.post_title);
                $(this.refs.postContent).val(resp.result.post_markdown);
                $(this.refs.postType).val(resp.result.post_type);
            })
            .fail((resp) => {
                this.setState({ hint: '加载失败，请刷新重试...' })
            });
    };

    render() {
        return (
            <div id="amend">
                <BaseEditComponent
                    action={window.graphqlAPI}
                    isLinkEditable={false}
                    method="PATCH"
                    hint='等待加载...'
                    params={this.props.params}
                    getInitData={this.getInitData} />
            </div>
        );
    };
}


export { Publish, Amend };
