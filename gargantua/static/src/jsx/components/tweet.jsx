'use strict';

import request from 'graphql-request';
import { BaseComponent } from './base.jsx';


const $ = window.$;


export class TwitterPage extends BaseComponent {
    render() {
        return (
            <div id="twitter" className="container-fluid">
                <div>{this.props.children}</div>
            </div>
        );
    }
}

export class Tweet extends BaseComponent {
    componentDidMount() {
        this.setState({
            text: '加载中…',
            images: [],
        });

        this.loadTweets();
    }

    async loadTweets() {
        let resp;
        try {
            resp = await request(window.graphqlAPI, `query {
            TwitterStatues(
                tweet_id: "${this.props.params.status_id}",
            ) {
                url
                text
                images
            }
        }`);
        } catch (err) {
            this.setState({ text: err.message });
            return;
        }

        if (resp.TwitterStatues.length < 1) {
            this.setState({ text: 'NotFound' });
            return;
        }

        this.setState({
            status_id: resp.TwitterStatues[0].id,
            text: resp.TwitterStatues[0].text,
            images: resp.TwitterStatues[0].images,
        });
    }

    render() {
        let images = [];
        let defaultImg = '';

        if (this.state.images) {
            this.state.images.forEach(ele => {
                images.push(
                    <img src={ele} alt="" />
                );
            });

            if (this.state.images.length != 0) {
                defaultImg = this.state.images[0];
            }
        }


        $('meta[name="twitter:card"]').remove();
        $('meta[name="twitter:title"]').remove();
        $('meta[name="twitter:description"]').remove();
        $('meta[name="twitter:image"]').remove();
        $('meta[name="twitter:site"]').remove();
        $('head').append('<meta name="twitter:card" content="summary_large_image" />');
        $('head').append(`<meta name="twitter:title" content="${this.state.status_id}" />`);
        $('head').append(`<meta name="twitter:description" content="${this.state.text}" />`);
        $('head').append(`<meta name="twitter:image" content="${defaultImg}" />`);
        $('head').append(`<meta name="twitter:site" content="https://blog.laisky.com/twitter/status/${this.state.status_id}/" />`);

        return (
            <article>
                {this.state.text}
                <div className="images">
                    {images}
                </div>
            </article>
        );
    }
}
