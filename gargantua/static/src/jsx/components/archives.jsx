/*
 * 关于博客文章的各种组件
 */

'use strict';

import { request } from 'graphql-request';
import React from 'react';
import { Link } from 'react-router';
import { BaseComponent } from './base.jsx';


const $ = window.$;

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
    }

    render() {
        return (
            <div id="postComment">
                <div id="disqus_thread"></div>
            </div>
        );
    }
}


// 文章
class ArchiveExtract extends BaseComponent {

    componentDidMount() {
        let $imgModal = $('#img-modal'),
            $modalImg = $('#img-modal .modal-body img');

        // image modal
        $(this.refs.archiveContent).on('click', 'img', (evt) => {
            let $target = $(evt.target);

            $modalImg.prop('src', $target.prop('src'));
            $imgModal.modal({
                show: true
            });
        });

        $imgModal.on('click', () => {
            $imgModal.modal('hide');
        });

        parseAndReplacePostSeries();
        // $('.archive-tail .pay').popover({
        //     html: true,
        //     trigger: 'hover',
        //     placement: 'top',
        //     content: function () {
        //         return '<img src="https://s3.laisky.com/uploads/2019/03/pay-merge.jpg" alt="pay"/>';
        //     }
        // });

        document.querySelectorAll('pre > code').forEach((block) => {
            window.hljs && window.hljs.highlightBlock(block);
        });

        // init TOC
        {
            let navSelector = "#archive-menu";
            if ($(navSelector).length != 0) {
                Toc.init({
                    // $scope: $("h2,h3"),
                    $nav: $(navSelector)
                });

                // $('body').scrollspy({
                //     target: $(navSelector)
                // });
            }
        }
    }


    getTagClickHandler() {
        return evt => {
            if (!window.google || !window.google.search.cse.element.getElement('post_search')) return;

            let query = $(evt.target).text();
            window.google.search.cse.element.getElement('post_search').execute(query);

            return false;
        };
    }

    getPostTails() {
        let articleEditable,
            archiveName = this.props['archive-name'],
            postCategory = this.props['archive-object'] && this.props['archive-object']['category'],
            postTags = this.props['archive-object'] && this.props['archive-object']['tags'] || [];

        if (this.getCurrentUsername()) {
            articleEditable = <Link to={{ pathname: `/amend/${archiveName}/` }}>编辑</Link>
        }

        let tagHtml = [];
        postTags.map(t => tagHtml.push(
            <span onClick={this.getTagClickHandler()} className="label label-info">{t}</span>
        ));

        let payment = [
            <link rel="prefetch" href="https://s3.laisky.com/uploads/2019/03/pay-merge.jpg"></link>,
            <span className="pay">打赏</span>,
        ];

        if (this.props['archive-object']) {
            return [
                <div className="category">
                    <span>Categories: </span>
                    <Link to={{ pathname: postCategory ? `/cate/${postCategory['url']}/` : '/cate/' }}>
                        {postCategory ? postCategory['name'] : 'TBD'}
                    </Link>
                </div>,
                <div className="tags">
                    <span>Tags: </span>
                    {tagHtml}
                </div>,
                // payment,
                articleEditable,
                // <Link to={{ pathname: `/p/${archiveName}/#disqus_thread` }} data-disqus-identifier={archiveName} target="_blank">评论</Link>
            ];
        }

        return [
            articleEditable,
            // <Link to={{ pathname: `/p/${archiveName}/#disqus_thread` }} data-disqus-identifier={archiveName} target="_blank">评论</Link>
        ];
    }

    render() {
        let archiveName = this.props['archive-name'],
            archiveUrl = `/p/${archiveName}/`,
            articleContent,
            articleEditable,
            archiveType = this.props['archive-type'] || 'markdown',
            amendUrl = `/amend/${archiveName}`;

        if (this.props.insertHTML) {
            if (archiveType == 'markdown') {
                articleContent = <article className="markdown-body" dangerouslySetInnerHTML={{ __html: this.props['archive-content'] }}></article>;
            } else if (archiveType == 'slide' || archiveType == 'html') {
                articleContent = <article dangerouslySetInnerHTML={{ __html: this.props['archive-content'] }}></article>;
            }
        } else {
            articleContent = <article>{this.props['archive-content']}</article>;
        }

        return <div className="archive archive-extract" id={this.props['archive-name']}>
            <h2 className="archive-title">
                <Link to={{ pathname: `/p/${archiveName}/` }}>{this.props['archive-title']}</Link>
            </h2>
            <div className="archive-meta">
                <span>published: </span>
                <span>{window.moment(this.props['archive-created-at']).format('YYYY/MM/DD HH:MM')}</span>
            </div>
            <div className="archive-content" ref="archiveContent" id="archiveContent">
                {articleContent}
            </div>
            <div className="archive-tail">
                {this.getPostTails()}
            </div>
        </div>;
    }
}


// 文章目录
class ArchiveMenu extends BaseComponent {
    render() {
        return (
            <nav id="archive-menu" className="navbar navbar-default navbar-static" role="navigation">
            </nav>
        );
    }
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
    }

    getDisplayPageNav() {
        let fromPage = Math.max(this.props.currentPage - 2, 1),
            nPage = fromPage,
            toPage = Math.min(Number.parseInt(this.props.currentPage) + 2, this.props.totalPage),
            pageNav = [];

        do {
            if (nPage == this.props.currentPage) {
                pageNav.push(
                    <li key={`pagenav-${nPage}`} className="active">
                        <Link className="page" to={{ pathname: `/archives/${nPage}/` }}>{nPage}</Link>
                    </li>
                );
            } else {
                pageNav.push(
                    <li key={`pagenav-${nPage}`}>
                        <Link className="page" to={{ pathname: `/archives/${nPage}/` }}>{nPage}</Link>
                    </li>
                );
            }
            nPage += 1;
        }
        while (nPage <= toPage)

        return pageNav;
    };

    getPrevious() {
        if (this.props.currentPage == 1) {
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
        if (this.props.currentPage == this.props.totalPage) {
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


function parseAndReplacePostSeries() {
    $('.archive-content article')
        .find('div.post_series')
        .each(async (_, seEle) => {
            let $block = $(seEle);
            let postkey = $block.attr('key');

            const se = await loadSeries(postkey);
            if (se == null) {
                return;
            }

            let html = parseSeriesHTML(se);
            for (let i = 0; i < se.children.length; i++) {
                html += await parseSeriesChildren(se.children[i].key);
            }

            html = `
                        <div class="panel panel-info">
                            <div class="panel-heading">
                                <h3 class="panel-title">${se.remark} Serials: </h3>
                            </div>
                            <div class="panel-body">
                                <ul>
                                    ${html}
                                </ul>
                            </div>
                        </div>`;
            $block.html(html);
        });
}

async function loadSeries(postkey) {
    const resp = await request(window.graphqlAPI, `query {
            GetBlogPostSeries(
                key: "${postkey}"
            ) {
                remark
                posts {
                    name
                    title
                }
                children {
                    key
                }
            }
        }`);

    if (resp.GetBlogPostSeries.length < 1) {
        return null;
    }

    return resp.GetBlogPostSeries[0];
}

function parseSeriesHTML(se) {
    let html = '';
    for (let i = 0; i < se.posts.length; i++) {
        let p = se.posts[i];
        html += `<li><a href="https://blog.laisky.com/p/${p.name}/">${p.title}</a></li>`;
    }

    return html;
}

async function parseSeriesChildren(seriesKey) {
    let se = await loadSeries(seriesKey);
    let sid = `series-${se.remark}`;
    let html = parseSeriesHTML(se);
    if (se.children.length != 0) {
        for (i = 0; i < se.children.length; i++) {
            html += parseSeriesChildren(se.children[i].key);
        }
    }

    html = `
            <li><a class="btn btn-light" data-toggle="collapse" href="#${sid}">
                <i class="bi bi-filter-left"></i>${se.remark} Serials：</a>
                <div id="${sid}" class="collapse">
                    <div class="card-body">
                        <ul>
                            ${html}
                        </ul>
                    </div>
                </div>
            </li>
        `

    return html;
}

export {
    ArchiveExtract,
    ArchiveNav,
    Comment,
    ArchiveMenu
};
