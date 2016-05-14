/**
 * Home Page
 */
'use strict';

import React from 'react';
import { Link } from 'react-router';

import { BaseComponent } from './components/base.jsx';


class App extends BaseComponent {
    constructor(props, context) {
        super(props, context);
    };

    static get contextTypes() {
        return {
            router: function () {
                return React.PropTypes.func.isRequired;
            }
        }
    };

    render() {
        let googleSearch = '<gcse:search className="google-search" gname="post_search" enableAutoComplete="true"></gcse:search>';

        return (
          <div className="container-fluid">
            <nav className="navbar navbar-default navbar-fixed-top">
              <div className="container-fluid">
                <div className="navbar-header">
                  <button type="button" className="navbar-toggle collapsed" data-toggle="collapse" data-target="#bs-example-navbar-collapse-1" aria-expanded="false">
                    <span className="sr-only">Toggle navigation</span>
                    <span className="icon-bar"></span>
                    <span className="icon-bar"></span>
                    <span className="icon-bar"></span>
                  </button>
                  <Link to={{ pathname: '/archives/1/' }} className="navbar-brand">Laisky</Link>
                </div>
                <div className="collapse navbar-collapse" id="bs-example-navbar-collapse-1">
                  <ul className="nav navbar-nav apps">
                    <li className={this.getCurrentRouteName() == 'archives'? 'active': ''}><Link to={{ pathname: '/archives/1/' }}>Blog</Link></li>
                    <li className={this.getCurrentRouteName() == 'aboutme'? 'active': ''}><Link to={{ pathname: '/about/' }}>AboutMe</Link></li>
                  </ul>
                  <ul className="nav navbar-nav navbar-right">
                    <li>
                      <a>{ this.getCurrentUsername() }</a>
                    </li>
                    <li>
                      <Link to={{ pathname: '/rss/' }} target="_blank"><span className="rss glyphicon glyphicon-th-list" aria-hidden="true"></span></Link>
                    </li>
                    <div className="navbar-form navbar-right nav-bar-search">
                      <div dangerouslySetInnerHTML={{ __html: googleSearch }} />
                    </div>
                  </ul>
                </div>
              </div>
            </nav>
            <div ref="container" className='container' id="container">
              {this.props.children}
            </div>
          </div>
        );
    };
}


export { App };
