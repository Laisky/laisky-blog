/**
 * 文章页
 */

'use strict';

import { request } from 'graphql-request';
import React from 'react';
import { ArchiveExtract, ArchiveMenu, Comment } from '../components/archives.jsx';
import { BaseComponent } from '../components/base.jsx';
import { Categories } from '../components/sidebar.jsx';


let $ = window.$;

/**
 * Post Article
 */
export class Post extends BaseComponent {
    constructor(props, context) {
        super(props, context);
        this.state = {
            post: null,
            hint: '载入中...'
        };

        let language = window.getUserLanguage();
        request(window.graphqlAPI, `query {
            BlogPosts(
                name: "${this.props.params.pid}",
                language: ${language},
            ) {
                title
                type
                content
                name
                menu
                tags
                created_at
                category {
                    name
                    url
                }
                arweave_id {
                    id
                    time
                }
            }
        }`)
            .then(resp => {
                if (resp.BlogPosts.length < 1) {
                    this.setState({ hint: '文章不存在' });
                }
                let post = resp.BlogPosts[0];

                document.title = post.title;
                if (post['type'] == 'slide') this.loadRevealJs();
                // post.content = this.convertImg2Webp(post.content);
                $(document.body).animate({ scrollTop: 0 }, 200);
                this.setState({
                    post: post,
                    hint: null
                });

                setTimeout(function () {
                    // $('body').scrollspy({ target: '#archive-menu' });
                    try {
                        window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub]);
                    } catch (e) {
                        console.error(e);
                    }
                }, 2000);
                setTimeout(function () {
                    try {
                        window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub]);
                    } catch (e) {
                        console.error(e);
                    }
                }, 4000);
                setTimeout(function () {
                    try {
                        window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub]);
                    } catch (e) {
                        console.error(e);
                    }
                }, 8000);
            })
            .catch((err) => {
                console.error(err);
                // this.setState({ hint: '读取数据失败，请刷新重试' });
            });
    }

    // http://blog.qiniu.com/archives/5793
    // should only work for qiniu
    convertImg2Webp(content) {
        if (navigator.browserInfo.name != 'Chrome') return content;
        return content.replace(
            // https://blog.laisky.com/qiniu/srceen_shot%202016-10-31%20at%2020.22.45.jpg
            /(\bhttps:\/\/blog\.laisky\.com\/qiniu\/[^/]+\.(jpg|jpeg|gif|png))/ig,
            '$1?imageMogr2/format/webp'
        );
    }

    loadRevealJs() {
        $.getScript(window.revealLibUrl)
            .done(function () {
                setTimeout(function () {
                    window.Reveal.initialize({
                        // Display controls in the bottom right corner
                        controls: true,
                        // Display a presentation progress bar
                        progress: true,
                        // Display the page number of the current slide
                        slideNumber: false,
                        // Push each slide change to the browser history
                        history: false,
                        // Enable keyboard shortcuts for navigation
                        keyboard: true,
                        // Enable the slide overview mode
                        overview: true,
                        // Vertical centering of slides
                        center: true,
                        // Enables touch navigation on devices with touch input
                        touch: true,
                        // Loop the presentation
                        loop: false,
                        // Change the presentation direction to be RTL
                        rtl: false,
                        // Randomizes the order of slides each time the presentation loads
                        shuffle: false,
                        // Turns fragments on and off globally
                        fragments: true,
                        // Flags if the presentation is running in an embedded mode,
                        // i.e. contained within a limited portion of the screen
                        embedded: false,
                        // Flags if we should show a help overlay when the questionmark
                        // key is pressed
                        help: true,
                        // Flags if speaker notes should be visible to all viewers
                        showNotes: false,
                        // Number of milliseconds between automatically proceeding to the
                        // next slide, disabled when set to 0, this value can be overwritten
                        // by using a data-autoslide attribute on your slides
                        autoSlide: 0,
                        // Stop auto-sliding after user input
                        autoSlideStoppable: true,
                        // Use this method for navigation when auto-sliding
                        autoSlideMethod: window.Reveal.navigateNext,
                        // Enable slide navigation via mouse wheel
                        mouseWheel: false,
                        // Hides the address bar on mobile devices
                        hideAddressBar: true,
                        // Opens links in an iframe preview overlay
                        previewLinks: false,
                        // Transition style
                        transition: 'default', // none/fade/slide/convex/concave/zoom
                        // Transition speed
                        transitionSpeed: 'default', // default/fast/slow
                        // Transition style for full page slide backgrounds
                        backgroundTransition: 'default', // none/fade/slide/convex/concave/zoom
                        // Number of slides away from the current that are visible
                        viewDistance: 3,
                        // Parallax background image
                        parallaxBackgroundImage: '', // e.g. "'https://s3.amazonaws.com/hakim-static/reveal-js/reveal-parallax-1.jpg'"
                        // Parallax background size
                        parallaxBackgroundSize: '', // CSS syntax, e.g. "2100px 900px"
                        // Number of pixels to move the parallax background per slide
                        // - Calculated automatically unless specified
                        // - Set to 0 to disable movement along an axis
                        parallaxBackgroundHorizontal: null,
                        parallaxBackgroundVertical: null,
                    });
                }, 2000);
            });
    }

    render() {
        let hintEle,
            postComment,
            postMenu,
            postContent;

        if (this.state.hint) {
            hintEle = <p className="hint">{this.state.hint}</p>;
        }

        if (this.state.post) {
            postComment = <Comment post-name={this.state.post.name} />;
            postContent = <ArchiveExtract key={this.state.post.name}
                insertHTML={true}
                archive-object={this.state.post}
                archive-type={this.state.post.type}
                archive-name={this.state.post.name}
                archive-title={this.state.post.title}
                archive-created-at={this.state.post.created_at}
                archive-history={this.state.post.arweave_id}
                archive-content={this.state.post.content} />;

            if (this.state.post.menu) {
                postMenu = (
                    <div className="col-sm-2 hidden-xs">
                        <ArchiveMenu content={this.state.post.menu} />;
                    </div>
                );
            }
        }

        return (
            <div className="container-fluid post-body" id="post">
                <div id="page-content" className={postMenu ? 'col-sm-10 col-xs-12' : 'container-fluid'}>
                    {hintEle}
                    {postContent}
                    {postComment}
                </div>
                {postMenu}
            </div>
        );
    }

}


/**
 * Post Categories
 */
export class PostCategories extends BaseComponent {

    componentDidMount() {
        this.loadArticlesByCategoryURL(this.props.params.cateURL);
    }

    componentWillReceiveProps(nextProps) {
        this.loadArticlesByCategoryURL(nextProps.params.cateURL);
    }

    async loadArticlesByCategoryURL(cateUrl) {
        let language = window.getUserLanguage();
        let resp = await request(window.graphqlAPI, `query {
            BlogPosts(
                category_url: ${cateUrl ? `"${cateUrl}"` : 'null'},
                page: {size: 200, page: 0},
                language: ${language},
            ) {
                title
                name
            }
        }`),
            html = '';

        for (let post of resp.BlogPosts) {
            html += `<p><a href="/p/${post.name}/" target="_blank">${post.title}</a></p>`;
        }
        this.setState({ categories: html });
    }

    render() {
        return (
            <div className="container-fluid post-body" id="post-categories">
                <div className="row">
                    <article className="col-xs-9" dangerouslySetInnerHTML={{ __html: this.state.categories }}></article>
                    <nav className="col-xs-2"><Categories /></nav>
                </div>
            </div>
        );
    }
}
