/**
 * Home Page
 */
'use strict';

import React from 'react';
import { Link } from 'react-router';

import { BaseComponent } from '../components/base.jsx';

/*
 * 页面主框架
 */
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


    getScrollToTopHandle() {
        return (evt) => {
            if(evt.target.tagName.toUpperCase() != 'DIV' || evt.target.className.startsWith('gsc-')) return;
            $(document.body).animate({scrollTop: 0}, 500);

            return false;
        }
    };

    render() {
        let googleSearch = '<gcse:search className="google-search" gname="post_search" enableAutoComplete="true"></gcse:search>';

        return (
          <div className="container-fluid">

            {/* page nav */}
            <nav className="navbar navbar-default navbar-fixed-top" onClick={this.getScrollToTopHandle()}>
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
                    <li><a href="//laisky.github.io/laisky-blog/CHANGELOG/" target="_blank">ChangeLog</a></li>
                  </ul>
                  <ul className="nav navbar-nav navbar-right">
                    <li>
                      <a>{ this.getCurrentUsername() }</a>
                    </li>
                    <li>
                      <Link to={{ pathname: '/rss/' }} target="_blank"><img src="https://laisky-cache.b0.upaiyun.com/gargantua/images/rss.png" className="rss"></img></Link>
                    </li>
                    <div className="navbar-form navbar-right nav-bar-search">
                      <div dangerouslySetInnerHTML={{ __html: googleSearch }} />
                    </div>
                  </ul>
                </div>
              </div>
            </nav>

            {/* page modal */}
            <div className="modal fade" id="img-modal">
              <div className="modal-dialog" style={{'z-index': 1050, width: '800px'}}>
                <div className="modal-content">
                  <div className="modal-body" style={{padding: '0px'}}>
                    <img src="" alt="image" className="img-rounded" style={{'max-height': '800px', 'max-width': '800px'}} />
                  </div>
                </div>
              </div>
            </div>

            {/* page content */}
            <div ref="container" className='container' id="container">
              {this.props.children}
            </div>
          </div>
        );
    };
}


export { App };
