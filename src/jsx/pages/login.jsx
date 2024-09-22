'use strict';

import { gql, request } from 'graphql-request';
import { jwtDecode } from 'jwt-decode';
import React, { useState } from 'react';

import { GraphqlAPI, KvKeyAuthUser } from '../library/base.jsx';
import * as libs from '../library/libs';
import { useNavigate } from 'react-router-dom';

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
        await libs.KvSet(KvKeyAuthUser, authUser);

        // after login, redirect to the page where user clicked login
        const queryParams = new URLSearchParams(window.location.search);
        const redirectTo = queryParams.get('redirect') || '/';
        navigate(redirectTo);
    };

    return (
        <div className="d-flex justify-content-center align-items-center vh-100">
            <form onSubmit={handleSubmit} className="p-4 border rounded bg-light">
                <h2 className="mb-4">Login</h2>
                <div className="mb-3">
                    <label htmlFor="email" className="form-label">Email address</label>
                    <input
                        type="email"
                        className="form-control"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div className="mb-3">
                    <label htmlFor="password" className="form-label">Password</label>
                    <input
                        type="password"
                        className="form-control"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <button type="submit" className="btn btn-primary w-100">Login</button>
            </form>
        </div>
    );
};
