'use strict';

import jsutils from '@laisky/js-utils';
import { FilePlus, LogIn, LogOut, Settings, Shield, User } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { getCurrentUsername, KvKeyAuthUser, KvKeyUserToken } from '../library/base';
import { buildSSOLoginURL, startSSOLogin } from '../library/sso';

/**
 * Admin renders login status and admin actions.
 *
 * @returns {React.ReactElement} The admin panel component.
 */
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
              <a href={buildSSOLoginURL()} onClick={loginHandler} className="d-inline-flex align-items-center">
                <LogIn size={14} className="me-2" />
                Login
              </a>
            </li>
          </ul>
        );
      }

      setLoginBtn(element);
      setUsername(username);
    })();
  }, [username]);

  /**
   * loginHandler redirects user to SSO login page directly.
   *
   * @param {React.MouseEvent<HTMLAnchorElement>} evt - The login link click event.
   * @returns {void} No return value.
   */
  const loginHandler = (evt) => {
    evt.preventDefault();
    startSSOLogin();
  };

  /**
   * logoutHandler clears local auth cache and reloads the current route.
   *
   * @param {React.MouseEvent<HTMLAnchorElement>} evt - The logout click event.
   * @returns {Promise<void>} Resolves after logout completion.
   */
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
