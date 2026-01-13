'use strict';

import React, { useEffect, useState } from 'react';
import { Link, useParams, useLoaderData, useNavigate } from 'react-router-dom';
import { FilePlus, Settings, LogOut, LogIn, Shield, User } from 'lucide-react';
import jsutils from '@laisky/js-utils';

import { getCurrentUsername, KvKeyAuthUser, KvKeyUserToken } from '../library/base';

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
            <p className="d-flex align-items-center">
              <User size={14} className="me-2" />
              Welcome, {username}
            </p>
            <ul>
              <li>
                <Link to="/publish/" className="d-inline-flex align-items-center">
                  <FilePlus size={14} className="me-2" />
                  Publish
                </Link>
              </li>
              <li>
                <Link to="/admin/" className="d-inline-flex align-items-center">
                  <Settings size={14} className="me-2" />
                  Manage
                </Link>
              </li>
              <li>
                <Link onClick={logoutHandler} className="d-inline-flex align-items-center">
                  <LogOut size={14} className="me-2" />
                  Logout
                </Link>
              </li>
            </ul>
          </div>
        );
      } else {
        element = (
          <ul>
            <li>
              <Link to="/login/" className="d-inline-flex align-items-center">
                <LogIn size={14} className="me-2" />
                Login
              </Link>
            </li>
          </ul>
        );
      }

      setLoginBtn(element);
      setUsername(username);
    })();
  }, [username]);

  const logoutHandler = async (evt) => {
    evt.preventDefault();
    await jsutils.KvDel(KvKeyAuthUser);
    await jsutils.KvDel(KvKeyUserToken);
    setUsername(null);
    navigate(0);
  };

  return (
    <section className="row console admin">
      <h2 className="d-flex align-items-center">
        <Shield size={14} className="me-2" />
        Admin
      </h2>
      {loginBtn}
    </section>
  );
};
