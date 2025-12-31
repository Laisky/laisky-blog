'use strict';

import { gql, request } from 'graphql-request';
import { jwtDecode } from 'jwt-decode';
import React, { useState } from 'react';

import jsUtils from '@laisky/js-utils';
import { useNavigate } from 'react-router-dom';
import { GraphqlAPI, KvKeyAuthUser, KvKeyUserToken } from '../library/base.jsx';

export const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        // login
        const gqBody = gql`
            mutation {
                UserLogin(
                    account: "${email}"
                    password: "${password}"
                ) {
                    token
                }
            }
        `;
        const resp = await request(GraphqlAPI, gqBody);
        const token = resp.UserLogin.token;
        const authUser = jwtDecode(token);
        await jsUtils.KvSet(KvKeyAuthUser, authUser);
        await jsUtils.KvSet(KvKeyUserToken, token);

        // after login, redirect to the page where user clicked login
        const queryParams = new URLSearchParams(window.location.search);
        const redirectTo = queryParams.get('redirect') || '/pages/0/';
        navigate(redirectTo);
    };

    return (
        <div className="scrollable-content auth-page">
            <form onSubmit={handleSubmit} className="auth-card" autoComplete="off">
                <h2>Welcome back</h2>
                <p className="text-muted mb-4">Sign in with your author credentials to continue.</p>
                <div className="mb-3">
                    <label htmlFor="email" className="form-label">
                        Email address
                    </label>
                    <input
                        id="email"
                        type="email"
                        className="form-control"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div className="mb-4">
                    <label htmlFor="password" className="form-label">
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        className="form-control"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <button type="submit" className="btn btn-primary w-100">
                    Login
                </button>
            </form>
        </div>
    );
};
