/*
 * 登录组件
 */

'use strict';

import { request } from 'graphql-request';
import React from 'react';
import { BaseComponent } from './base.jsx';

const $ = window.$;

class Auth extends BaseComponent {
    constructor(props, context) {
        super(props, context);
        this.state = {};
    }

    getHandleSubmit() {
        return (evt) => {
            let accountName = this.state.accountName,
                passowrdName = this.state.passowrdName,
                next = QueryString['next'] || '/',
                data = { is_keep_login: $(this.refs.isKeepLogin).prop('checked') };

            evt.preventDefault();

            data[this.state.accountName] = this.refs.account.value;
            data[this.state.passwordName] = this.refs.password.value.getMD5();

            const query = `mutation {
                BlogLogin(account:"${this.refs.account.value}", password:"${this.refs.password.value}") {
                    user {
                        username
                    }
                    token
                }
            }`;
            request(this.state.action, query)
                .then(data => {
                    console.log("got", data.BlogLogin);
                    $(this.refs.hint).text(`welcome ${data.BlogLogin.user.username}`);
                    window.Cookies.set('token', data.BlogLogin.token, { expires: 7 });
                    location.href = next;
                })
                .catch(err => {
                    $(this.refs.hint).text(`${err.message}`);
                });
        };
    }

    componentDidMount() {
        this.setState({
            method: this.props.method || 'POST',
            action: this.props.action,
            accountLabel: this.props.accountLabel || '账户名',
            accountName: this.props.accountName || 'account',
            accountPlaceholder: this.props.accountPlaceholder || '请输入账户名',
            passwordLabel: this.props.passwordLabel || '密码',
            passwordName: this.props.passwordName || 'password',
            passwordPlaceholder: this.props.passwordPlaceholder || '请输入密码',
            siginLabel: this.props.siginLabel || '登录',
            singupLabel: this.props.singupLabel || '注册'
        });
    }

    render() {
        return (
            <div className="loginComponent container-fluid">
                <div className="row hint">
                    <p ref="hint" className="hint-text label label-info">请登录</p>
                </div>
                <form className="form-horizontal" method={this.state.method} action={this.state.action}>
                    <div className="form-group">
                        <label for="account" className="col-sm-2 control-label">{this.state.accountLabel}</label>
                        <div className="col-sm-10">
                            <input ref="account" type="email" className="form-control account" placeholder={this.state.accountPlaceholder} name="account" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label for="passowrd" className="col-sm-2 control-label">{this.state.passwordLabel}</label>
                        <div className="col-sm-10">
                            <input ref="password" type="password" className="form-control password" placeholder={this.state.passwordPlaceholder} name="password" />
                        </div>
                    </div>
                    <div className="form-group">
                        <div className="col-sm-offset-2 col-sm-10">
                            <div className="checkbox">
                                <label>
                                    <input ref="isKeepLogin" type="checkbox" className="keepLoginInput" checked />
                                    <span>Remember me</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    <div className="form-group">
                        <div className="col-sm-offset-2 col-sm-10">
                            <button onClick={this.getHandleSubmit()} type="submit" className="signinBtn btn btn-default">{this.state.siginLabel}</button>
                            <button onClick={this.getHandleSubmit()} disabled="true" type="submit" className="signupBtn btn btn-default">{this.state.singupLabel}</button>
                        </div>
                    </div>
                </form>
            </div>
        );
    }
}


export { Auth };
