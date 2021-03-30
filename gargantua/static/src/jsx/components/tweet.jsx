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
            text: '加载中…'
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

        this.setState({ text: resp.TwitterStatues[0].text });
    }

    render() {
        return (
            <article>
                {this.state.text}
            </article>
        );
    }
}
