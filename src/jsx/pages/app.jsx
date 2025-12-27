import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
    Languages,
    Terminal,
    FileText,
    User,
    Activity,
    Rss,
    BotMessageSquare,
    Factory,
} from 'lucide-react';
import jsutils from '@laisky/js-utils';

import { getUserLanguage, setUserLanguage } from '../library/base';

const isActiveRoute = (routeName, currentRoute) => {
    return routeName === currentRoute ? 'active' : '';
};

export const App = () => {
    const [userLang, setUserLang] = useState(null);
    const [theme, setTheme] = useState('light');
    0;
    const location = useLocation();
    // const navigate = useNavigate();

    const scrollToTop = (evt) => {
        if (evt.target.tagName.toUpperCase() != 'DIV' || evt.target.className.startsWith('gsc-'))
            return;

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
                    await jsutils.LoadJsModules([
                        'https://www.googletagmanager.com/gtag/js?id=G-BVS991NWWS',
                    ]);
                    window.dataLayer = window.dataLayer || [];
                    function gtag() {
                        dataLayer.push(arguments);
                    }
                    gtag('js', new Date());
                    gtag('config', 'G-BVS991NWWS');
                })()
            );

            // load google search
            fs.push(
                jsutils.LoadJsModules([
                    'https://cse.google.com/cse.js?cx=004733495569415005684:-c6y46kjqva',
                ])
            );

            await Promise.all(fs);
        })();

        watchThemeChange(setTheme);
    }, []);

    // watch theme change
    useEffect(() => {
        document.documentElement.setAttribute(
            'data-bs-theme',
            window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        );
    }, [theme]);

    const getCurrentRouteName = () => {
        // Extract the route name based on the current location
        const pathname = location.pathname;
        if (pathname.startsWith('/pages/')) {
            return 'posts';
        } else if (pathname.startsWith('/about/')) {
            return 'aboutme';
        } else {
            return ''; // Default or fallback route name
        }
    };

    const handleLanguageChange = async (evt, newLang) => {
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
        setUserLang(newLang); // Update the state immediately
    };

    const dropdownBtn = (
        <div className="dropdown">
            <a
                className="nav-link p-2"
                href="#"
                role="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
            >
                <Languages size={16} />
            </a>
            <ul className="dropdown-menu dropdown-menu-end" style={{ minWidth: 'auto' }}>
                <li>
                    <a
                        className={`dropdown-item ${userLang === 'zh_CN' ? 'active' : ''}`}
                        href="#"
                        onClick={(e) => handleLanguageChange(e, 'zh_CN')}
                    >
                        zh_CN
                    </a>
                </li>
                <li>
                    <a
                        className={`dropdown-item ${userLang === 'en_US' ? 'active' : ''}`}
                        href="#"
                        onClick={(e) => handleLanguageChange(e, 'en_US')}
                    >
                        en_US
                    </a>
                </li>
            </ul>
        </div>
    );

    // enableAutoComplete is a non-standard tag;
    // avoid placing it directly in JSX to prevent browser errors.
    const googleSearch = `<div class="gcse-search"
            data-gname="post_search"
            data-enableHistory="true"
            data-enableAutoComplete="true"
        ></div>`;

    return (
        <>
            <nav
                className="navbar navbar-expand-sm bg-body-tertiary fixed-top"
                id="headerbar"
                onClick={scrollToTop}
            >
                <div className="container-fluid">
                    <Link to="/pages/0/" className="navbar-brand d-flex align-items-center">
                        <span className="d-flex align-items-center">
                            <Terminal size={20} className="me-2" /> Laisky
                        </span>
                    </Link>

                    <div className="d-flex align-items-center ms-auto">
                        {dropdownBtn}
                        <button
                            className="navbar-toggler ms-2"
                            type="button"
                            data-bs-toggle="collapse"
                            data-bs-target="#navbarTogglerDemo01"
                            aria-controls="navbarTogglerDemo01"
                            aria-expanded="false"
                            aria-label="Toggle navigation"
                        >
                            <span className="navbar-toggler-icon"></span>
                        </button>
                    </div>

                    <div className="collapse navbar-collapse" id="navbarTogglerDemo01">
                        <ul className="navbar-nav me-auto mb-lg-0">
                            <li className="nav-item">
                                <Link
                                    to="/pages/0/"
                                    className={`nav-link ${isActiveRoute('posts', getCurrentRouteName())}`}
                                    aria-current="page"
                                >
                                    <FileText size={16} className="me-1" /> Posts
                                </Link>
                            </li>
                            <li className="nav-item">
                                <Link
                                    to="/about/"
                                    className={`nav-link ${isActiveRoute('aboutme', getCurrentRouteName())}`}
                                >
                                    <User size={16} className="me-1" /> About
                                </Link>
                            </li>
                            <li className="nav-item">
                                <a
                                    className="nav-link"
                                    href="https://chat.laisky.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <BotMessageSquare size={16} className="me-1" /> AIChat
                                </a>
                            </li>
                            <li className="nav-item">
                                <a
                                    className="nav-link"
                                    href="https://mcp.laisky.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Factory size={16} className="me-1" /> MCP
                                </a>
                            </li>
                            <li className="nav-item">
                                <a
                                    className="nav-link"
                                    href="https://status.laisky.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Activity size={16} className="me-1" /> Status
                                </a>
                            </li>
                            <li className="nav-item">
                                <Link
                                    to="https://s3.laisky.com/public/rss.xml"
                                    target="_blank"
                                    className="nav-link"
                                    rel="noopener noreferrer"
                                >
                                    <Rss size={16} className="me-1" /> RSS
                                </Link>
                            </li>
                        </ul>
                        <ul className="navbar-nav">
                            <form
                                className="d-flex me-2"
                                role="search"
                                dangerouslySetInnerHTML={{ __html: googleSearch }}
                            ></form>
                        </ul>
                    </div>
                </div>
            </nav>

            {/* page modal */}
            <div className="modal" id="img-modal" role="dialog" tabIndex="-1">
                <div
                    className="modal-dialog"
                    role="document"
                    style={{ zIndex: 1050, width: '800px' }}
                >
                    <div className="modal-content">
                        <div className="modal-body" style={{ padding: '0px' }}>
                            <img
                                src=""
                                alt="image"
                                className="img-rounded"
                                style={{ maxHeight: '800px', maxWidth: '800px' }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* page content */}
            <div id="container">
                <Outlet />
            </div>
        </>
    );
};

let _watchThemeChanged = false;

const watchThemeChange = (setTheme) => {
    if (_watchThemeChanged) {
        return;
    }

    _watchThemeChanged = true;
    setInterval(() => {
        const theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        setTheme(theme);
    }, 1000);
};
