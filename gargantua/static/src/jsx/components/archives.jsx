/*
 * 关于博客文章的各种组件
 */

'use strict';

import React from 'react';
import { Link } from 'react-router';

import { BaseComponent } from './base.jsx';


// 评论
class Comment extends BaseComponent {
    componentDidMount() {
        let identify = this.props['post-name'],
            script = `
                var disqus_shortname = "laisky";
                var disqus_identifier = "${identify}";

                (function() {
                    var dsq = document.createElement('script'); dsq.type = 'text/javascript'; dsq.async = true;
                    dsq.src = '//' + disqus_shortname + '.disqus.com/embed.js';
                    (document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(dsq);
                })();
            `;

        $.globalEval(script);
    };

    render() {
        return (
            <div id="postComment">
                <div id="disqus_thread"></div>
            </div>
        );
    };
}


// 文章
class ArchiveExtract extends BaseComponent {
    componentDidMount() {
        let $imgModal = $("#img-modal"),
            $modalImg = $("#img-modal .modal-body img");

        $(this.refs.archiveContent).on('click', 'img', (evt) => {
            let $target = $(evt.target);

            $modalImg.prop("src", $target.prop("src"));
            $imgModal.modal({
                show: true
            });
        })
    };

    render() {
        let archiveName = this.props['archive-name'],
            archiveUrl = `/p/${archiveName}/`,
            articleContent,
            articleEditable,
            archiveType = this.props['archive-type'] || 'markdown',
            amendUrl = `/amend/${archiveName}`;

        if(this.getCurrentUsername()) {
            articleEditable = <Link to={{ pathname: `/amend/${archiveName}/` }}>编辑</Link>
        }

        if(this.props.insertHTML) {
            if(archiveType == 'markdown') {
                articleContent = <article className="markdown-body" dangerouslySetInnerHTML={{__html: this.props['archive-content']}}></article>
            }else if(archiveType == 'slide') {
                articleContent = <article dangerouslySetInnerHTML={{__html: this.props['archive-content']}}></article>
            }
        }else {
            articleContent = <article data-spy="scroll" data-target=".archive-menu">{ this.props['archive-content'] }</article>
        }

        return <div className="archive archive-extract" id={ this.props['archive-name'] }>
            <h2 className="archive-title">
                <Link to={{ pathname: `/p/${archiveName}/` }}>{ this.props['archive-title'] }</Link>
            </h2>
            <div className="archive-meta">
                <span>发布于：</span>
                <span>{this.formatTs(this.props['archive-created-at'])}</span>
            </div>
            <div className="archive-content" ref="archiveContent">
                {articleContent}
            </div>
            <div className="archive-tail">
                {articleEditable}
                <Link to={{ pathname: `/p/${archiveName}/#disqus_thread` }} data-disqus-identifier={archiveName} target="_blank">0 评论</Link>
            </div>
        </div>
    };
}


// 文章目录
class ArchiveMenu extends BaseComponent {
    render() {
        return (
            <nav className="archive-menu" dangerouslySetInnerHTML={{ __html: this.props.content }}>
            </nav>
        );
    };
}


// 文章翻页
class ArchiveNav extends BaseComponent {
    render() {
        let previous = this.getPrevious(),
            next = this.getNext(),
            pageNav = this.getDisplayPageNav();

        return (
            <nav className="archives page-nav">
                <ul className="pagination">
                    {previous}
                    {pageNav}
                    {next}
                </ul>
            </nav>
        );
    };

    getDisplayPageNav() {
        let fromPage = Math.max(this.props.currentPage - 2, 1),
            nPage = fromPage,
            toPage = Math.min(Number.parseInt(this.props.currentPage) + 2, this.props.totalPage),
            pageNav = [];

        do {
            if(nPage == this.props.currentPage) {
                pageNav.push(
                    <li key={`pagenav-${nPage}`} className="active">
                        <Link className="page" to={{ pathname: `/archives/${nPage}/` }}>{nPage}</Link>
                    </li>
                );
            }else {
                pageNav.push(
                    <li key={`pagenav-${nPage}`}>
                        <Link className="page" to={{ pathname: `/archives/${nPage}/` }}>{nPage}</Link>
                    </li>
                );
            }
            nPage += 1;
        }
        while(nPage <= toPage)

        return pageNav;
    };

    getPrevious() {
        if(this.props.currentPage == 1) {
            return (
                <li disabled>
                    <span aria-hidden="true">&laquo;</span>
                </li>
            );
        }
        else {
            let prePage = Math.max(this.props.currentPage - 1, 0);

            return (
                <li >
                    <Link to={{ pathname: `/archives/${prePage}/` }} aria-label="Previous" className="page-previous">
                        <span aria-hidden="true">&laquo;</span>
                    </Link>
                </li>
            );
        }
    };

    getNext() {
        if(this.props.currentPage == this.props.totalPage) {
            return (
                <li disabled>
                    <span aria-hidden="true">&raquo;</span>
                </li>
            );
        }
        else {
            let nextPage = Math.min(Number.parseInt(this.props.currentPage) + 1, this.props.totalPage);

            return (
                <li >
                    <Link to={{ pathname: `/archives/${nextPage}/` }} aria-label="Next" className="page-next">
                        <span aria-hidden="true">&raquo;</span>
                    </Link>
                </li>
            );
        }
    };
}


export {
    ArchiveExtract,
    ArchiveNav,
    Comment,
    ArchiveMenu
};
