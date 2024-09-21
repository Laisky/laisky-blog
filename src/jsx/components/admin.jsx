'use strict';

import React, { useEffect, useState } from 'react';
import { Link, useParams, useLoaderData } from 'react-router-dom';

import { getCurrentUsername } from '../library/base';

export const Admin = () => {
    const [loginBtn, setLoginBtn] = useState('');

    useEffect(() => {
        (async () => {
            const username = await getCurrentUsername();

            let element;
            if (username) {
                element = (
                    <div>
                        <p><Link to="/publish/">Publish</Link></p>
                        <p><Link to="/admin/">Manage</Link></p>
                        <p><Link>Logout</Link></p>
                    </div>
                );
            } else {
                element = <Link to="/login/">Login</Link>;
            }

            setLoginBtn(element);
        })();
    }, []);

    return (
        <section className="row console admin">
            <h2>Admin</h2>
            {loginBtn}
        </section>
    );
};
