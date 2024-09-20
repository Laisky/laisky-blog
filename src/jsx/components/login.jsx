'use strict';

import React from 'react';
import { Link, useParams, useLoaderData } from 'react-router-dom';

import { getCurrentUsername } from '../library/base';

export const Login = () => {
    const username = getCurrentUsername();
    let loginBtn;

    if (username) {
        loginBtn = (
            <div>
                <p><Link to="/publish/">Publish</Link></p>
                <p><Link to="/admin/">Manage</Link></p>
                <p><a className="btn">Logout</a></p>
            </div>
        );
    } else {
        loginBtn = <Link to="/login/">Login</Link>;
    }

    return (
        <section className="row console login">
            <h2>Admin</h2>
            {loginBtn}
        </section>
    );
};
