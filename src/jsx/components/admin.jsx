'use strict';

import React, { useEffect, useState } from 'react';
import { Link, useParams, useLoaderData, useNavigate } from 'react-router-dom';

import { getCurrentUsername, KvKeyAuthUser, KvKeyUserToken } from '../library/base';
import { KvDel } from '../library/libs';

export const Admin = () => {
    const [loginBtn, setLoginBtn] = useState('');
    const [username, setUsername] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        (async () => {
            const username = await getCurrentUsername();

            let element;
            if (username) {
                element = (
                    <div>
                        <p>Welcome, {username}</p>
                        <p><Link to="/publish/">Publish</Link></p>
                        <p><Link to="/admin/">Manage</Link></p>
                        <p><Link onClick={logoutHandler}>Logout</Link></p>
                    </div>
                );
            } else {
                element = <Link to="/login/">Login</Link>;
            }

            setLoginBtn(element);
            setUsername(username);
        })();
    }, [username]);

    const logoutHandler = async (evt) => {
        evt.preventDefault();
        await KvDel(KvKeyAuthUser);
        await KvDel(KvKeyUserToken);
        setUsername(null);
        navigate(0);
    }


    return (
        <section className="row console admin">
            <h2>Admin</h2>
            {loginBtn}
        </section>
    );
};
