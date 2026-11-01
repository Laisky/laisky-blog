'use strict';

import { FilePlus, LogIn, LogOut, Settings, Shield, User } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { SessionStatus, signOut } from '../library/session.js';
import { startSSOLogin } from '../library/sso';
import { useSession } from '../library/useSession.js';

/**
 * Admin renders login status and admin actions.
 *
 * @returns {React.ReactElement} The admin panel component.
 */
export const Admin = () => {
  const session = useSession();
  const [authError, setAuthError] = useState('');
  const [signOutFailed, setSignOutFailed] = useState(false);
  const navigate = useNavigate();

  /**
   * loginHandler redirects user to SSO login page directly.
   *
   * @param {React.MouseEvent<HTMLButtonElement>} evt - The login button click event.
   * @returns {Promise<void>} Resolves after navigation or displaying a safe error.
   */
  const loginHandler = async (evt) => {
    evt.preventDefault();
    const button = evt.currentTarget;
    button.disabled = true;
    setAuthError('');
    try {
      await startSSOLogin();
    } catch {
      setAuthError('Sign-in could not be started. Please try again.');
    } finally {
      button.disabled = false;
    }
  };

  /**
   * logoutHandler removes the session and reloads the current route, or keeps the page and says so when it cannot.
   *
   * @param {React.MouseEvent<HTMLAnchorElement>} evt - The logout click event.
   * @returns {Promise<void>} Resolves after logout completion or displaying a safe error.
   */
  const logoutHandler = async (evt) => {
    evt.preventDefault();
    setSignOutFailed(false);
    try {
      await signOut();
    } catch {
      setSignOutFailed(true);
      return;
    }
    navigate(0);
  };

  return (
    <section className="row console admin">
      <h2 className="d-flex align-items-center">
        <Shield size={14} className="me-2" />
        Admin
      </h2>
      {session?.status === SessionStatus.SignedIn && (
        <div>
          <p className="d-flex align-items-center">
            <User size={14} className="me-2" />
            Welcome, {session.username}
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
      )}
      {session?.status === SessionStatus.SignedOut && (
        <ul>
          <li>
            <button type="button" onClick={loginHandler} className="btn btn-link p-0 d-inline-flex align-items-center">
              <LogIn size={14} className="me-2" />
              Login
            </button>
          </li>
        </ul>
      )}
      {session?.status === SessionStatus.Unavailable && <p role="status">Sign-in status is unavailable right now.</p>}
      {authError && <p role="alert">{authError}</p>}
      {signOutFailed && session?.status === SessionStatus.SignedIn && (
        <p role="alert">Sign-out could not be completed, so you are still signed in. Please try again.</p>
      )}
    </section>
  );
};
