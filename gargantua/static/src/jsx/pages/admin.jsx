/**
 * Admin Page
 */
'use strict';

import { Link } from 'react-router';
import { BaseComponent } from '../components/base.jsx';


const $ = window.$;


export class AdminPage extends BaseComponent {
    render() {
        return (
            <div id="admin" className="container-fluid">
                <nav>
                    <h1>管理项</h1>
                    <ul>
                        <p><Link to={{ pathname: '/admin/cate/' }}>文章归类</Link></p>
                    </ul>
                </nav>
                <div>{this.props.children}</div>
            </div>
        );
    }
}


export class CategoriesConsole extends BaseComponent {
    componentDidMount(...args) {
        let p_articles = this.loadArticlesByCategory(),
            p_categories = this.loadCategories();

        Promise.all([p_articles, p_categories])
            .then(([respArticles, respCategories]) => {
                let articles = respArticles['result'],
                    categories = respCategories['result'];

                this.setState({
                    articles: this.generateArticlesHTML(articles, categories)
                });
            });
    };

    async loadCategories() {
        let url = '/api/v2/post/category/';
        return $.getJSON(url);
    }

    async loadArticlesByCategory(category = 'null') {
        let url = `/api/v2/post/?category=${category}&truncate=0`;
        return $.getJSON(url);
    }

    generateArticlesHTML(articles, categories) {
        let html = '',
            html_cate = '<option value=""></option>';

        for (let cate of categories) {
            html_cate += `
                <option value="${cate['_id']}">${cate['name']}</option>
            `;
        }

        for (let article of articles) {
            html += `
                <div class="form-group">
                    <label class="col-sm-10 control-label">
                        <a href="/p/${article.post_name}/" target="_blank">${article.post_title}</a>
                    </label>
                    <div class="col-sm-2">
                        <select class="form-control" name="${article.post_id}">
                            ${html_cate}
                        </select>
                    </div>
                </div>
            `;
        }
        return html;
    }


    getHandleSubmit() {
        /**
         * POST {post_id: category_id}
         */
        return evt => {
            let data = {
                categories: {}
            };
            $('#admin .articles select')
                .each((idx, item) => {
                    let $item = $(item);
                    if (!$item.val())
                        return;

                    data['categories'][$item.attr('name')] = $item.val();
                });

            let url = $('#admin .category-console form').attr('action');
            data['categories'] = JSON.stringify(data['categories']);
            $.ajax({
                url: url,
                data: this.addXSRF(data),
                method: 'PUT'
            })
                .done(resp => {
                    window.location.reload();
                });

            evt.stopPropagation();
            evt.preventDefault();
            return false;
        };
    }


    render() {
        return (
            <div className="container-fluid">
                <nav className="row">
                    <h1 className="title">编辑类别</h1>
                </nav>
                <div className="row category-console">
                    <form className="articles form-horizontal" action="/api/v2/post/category/" method="post" onSubmit={this.getHandleSubmit()}>
                        <div dangerouslySetInnerHTML={{ __html: this.state.articles }}></div>
                        <button type="submit" className="btn btn-success submit">提交更新</button>
                    </form>
                </div>
            </div>
        );
    }
}
