import jsutils from '@laisky/js-utils';
import { Activity, BotMessageSquare, Factory, FileText, Languages, Menu, Rss, Search, Terminal, User, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, ScrollRestoration, useLocation } from 'react-router-dom';

import { Dropdown, DropdownItem } from '../components/Dropdown';
import { getUserLanguage, setUserLanguage } from '../library/base';

/**
 * isActiveRoute checks if the given route name matches the current route.
 *
 * @param {string} routeName - The route name to check
 * @param {string} currentRoute - The current route name
 * @returns {string} 'active' if match, empty string otherwise
 */
const isActiveRoute = (routeName, currentRoute) => {
  return routeName === currentRoute ? 'active' : '';
};

/**
 * App is the main application component containing the navbar and routing outlet.
 *
 * @returns {React.ReactElement} The main app layout
 */
export const App = () => {
  const [userLang, setUserLang] = useState(null);
  const [theme, setTheme] = useState('light');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  /**
   * scrollToTop scrolls the page to the top when clicking on container areas.
   */
  const scrollToTop = (evt) => {
    // Only scroll to top if clicking on the navbar background itself
    // and not on any interactive elements.
    if (
      evt.target !== evt.currentTarget &&
      !evt.target.classList.contains('container-fluid') &&
      !evt.target.classList.contains('navbar-collapse')
    ) {
      return;
    }

    evt.preventDefault();
    evt.stopPropagation();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    (async () => {
      const lang = await getUserLanguage();
      setUserLanguage(lang);
      setUserLang(lang);

      let fs = [];

      // add google analytics
      fs.push(
        (async () => {
          await jsutils.LoadJsModules(['https://www.googletagmanager.com/gtag/js?id=G-BVS991NWWS']);
          window.dataLayer = window.dataLayer || [];
          function gtag() {
            window.dataLayer.push(arguments);
          }
          gtag('js', new Date());
          gtag('config', 'G-BVS991NWWS');
        })()
      );

      // load google search
      fs.push(jsutils.LoadJsModules(['https://cse.google.com/cse.js?cx=004733495569415005684:-c6y46kjqva']));

      await Promise.all(fs);
    })();

    const cleanupTheme = watchThemeChange(setTheme);
    return () => {
      if (cleanupTheme) cleanupTheme();
    };
  }, []);

  // watch theme change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }, [theme]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Handle body scroll lock
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [mobileMenuOpen]);

  // Close mobile menu when Google CSE search overlay opens
  // Also add click handler to close search when clicking on backdrop
  useEffect(() => {
    /**
     * closeSearchOverlay closes the Google CSE search overlay by clicking
     * the close button or removing the overlay elements.
     */
    const closeSearchOverlay = () => {
      // Try clicking the native close button first
      const closeBtn = document.querySelector('.gsc-results-close-btn');
      if (closeBtn) {
        closeBtn.click();
        return;
      }

      // Fallback: remove the overlay elements manually
      const overlay = document.querySelector('.gsc-results-wrapper-overlay');
      const backdrop = document.querySelector('.gsc-modal-background-image');
      if (overlay) overlay.style.display = 'none';
      if (backdrop) backdrop.style.display = 'none';
    };

    /**
     * handleBackdropClick handles clicks on the modal backdrop to close the search overlay.
     *
     * @param {Event} evt - The click event
     */
    const handleBackdropClick = (evt) => {
      if (evt.target.classList?.contains('gsc-modal-background-image')) {
        evt.preventDefault();
        evt.stopPropagation();
        closeSearchOverlay();
      }
    };

    // Add click handler for backdrop
    document.addEventListener('click', handleBackdropClick, true);

    // Only observe direct children of body for CSE overlay injection
    // (Google CSE appends the overlay as a direct child of body)
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.classList?.contains('gsc-results-wrapper-overlay') || node.classList?.contains('gsc-modal-background-image')) {
              setMobileMenuOpen(false);
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: false,
    });

    return () => {
      observer.disconnect();
      document.removeEventListener('click', handleBackdropClick, true);
    };
  }, []);

  /**
   * getCurrentRouteName extracts the route name based on the current location.
   */
  const getCurrentRouteName = () => {
    const pathname = location.pathname;
    if (pathname.startsWith('/pages/')) {
      return 'posts';
    } else if (pathname.startsWith('/about/')) {
      return 'aboutme';
    } else {
      return '';
    }
  };

  /**
   * handleLanguageChange handles language selection changes.
   */
  const handleLanguageChange = useCallback(
    async (evt, newLang) => {
      if (evt) {
        evt.preventDefault();
        evt.stopPropagation();
      }

      // remove query parameter `lang=`
      const url = new URL(window.location.href);
      url.searchParams.delete('lang');
      window.history.replaceState({}, document.title, url);

      if (userLang === newLang) return;

      await setUserLanguage(newLang);
      setUserLang(newLang);
    },
    [userLang]
  );

  const languageDropdownTrigger = (
    <span className="nav-link p-2">
      <Languages size={16} />
    </span>
  );

  const languageDropdown = (
    <Dropdown trigger={languageDropdownTrigger} align="end">
      <DropdownItem active={userLang === 'zh_CN'} onClick={(e) => handleLanguageChange(e, 'zh_CN')}>
        zh_CN
      </DropdownItem>
      <DropdownItem active={userLang === 'en_US'} onClick={(e) => handleLanguageChange(e, 'en_US')}>
        en_US
      </DropdownItem>
    </Dropdown>
  );

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <>
      <a href="#container" className="skip-link">
        Skip to content
      </a>
      <nav className="navbar navbar-expand-sm bg-body-tertiary fixed-top" id="headerbar" onClick={scrollToTop}>
        <div className="container-fluid">
          <Link to="/pages/0/" className="navbar-brand d-flex align-items-center">
            <span className="d-flex align-items-center">
              <Terminal size={20} className="me-2" /> Laisky
            </span>
          </Link>

          <div className={`navbar-collapse ${mobileMenuOpen ? 'show' : 'collapse'}`} id="navbarTogglerDemo01">
            <ul className="navbar-nav me-auto mb-lg-0">
              <li className="nav-item">
                <Link to="/pages/0/" className={`nav-link ${isActiveRoute('posts', getCurrentRouteName())}`} aria-current="page">
                  <FileText size={16} className="me-1" /> Posts
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/about/" className={`nav-link ${isActiveRoute('aboutme', getCurrentRouteName())}`}>
                  <User size={16} className="me-1" /> About
                </Link>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="https://chat.laisky.com" target="_blank" rel="noopener noreferrer">
                  <BotMessageSquare size={16} className="me-1" /> AIChat
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="https://mcp.laisky.com" target="_blank" rel="noopener noreferrer">
                  <Factory size={16} className="me-1" /> MCP
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="https://status.laisky.com" target="_blank" rel="noopener noreferrer">
                  <Activity size={16} className="me-1" /> Status
                </a>
              </li>
              <li className="nav-item">
                <Link to="https://s3.laisky.com/public/rss.xml" target="_blank" className="nav-link" rel="noopener noreferrer">
                  <Rss size={16} className="me-1" /> RSS
                </Link>
              </li>
            </ul>
          </div>

          <div className="navbar-actions d-flex align-items-center ms-auto">
            <button
              className="navbar-toggler"
              type="button"
              onClick={toggleMobileMenu}
              aria-controls="navbarTogglerDemo01"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="navbar-search d-flex mx-2" onClick={() => document.querySelector('.navbar-search input.gsc-input')?.focus()}>
              <Search size={16} className="search-icon me-1" />
              <div className="gcse-search" data-gname="post_search" data-enablehistory="true" data-enableautocomplete="true"></div>
            </div>
            <div>{languageDropdown}</div>
          </div>
        </div>
      </nav>

      {/* page content */}
      <main id="container">
        <Outlet />
      </main>

      {/* Scroll restoration for browser back/forward navigation */}
      <ScrollRestoration />
    </>
  );
};

/**
 * watchThemeChange watches for system theme changes via matchMedia listener.
 *
 * @param {Function} setTheme - React state setter for theme
 * @returns {Function} Cleanup function to remove the listener
 */
const watchThemeChange = (setTheme) => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e) => {
    setTheme(e.matches ? 'dark' : 'light');
  };

  mediaQuery.addEventListener('change', handler);
  return () => mediaQuery.removeEventListener('change', handler);
};
