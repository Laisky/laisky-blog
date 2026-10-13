/**
 * enhancePostMenu enhances menu links with tooltips for truncated text.
 */
export const enhancePostMenu = () => {
  try {
    const postMenu = document.querySelector('.post-menu');
    const timer = setTimeout(() => {
      if (!postMenu?.isConnected) return;
      if (!postMenu) {
        return;
      }

      const menuLinks = postMenu.querySelectorAll('a');

      if (menuLinks.length === 0) {
        postMenu.classList.add('is-hidden');
      } else {
        postMenu.classList.remove('is-hidden');
      }

      // Clean up existing tooltip wrappers
      menuLinks.forEach((link) => {
        link.removeAttribute('data-tooltip');
        link.removeAttribute('title');
      });

      // Batch DOM reads: create all measurement spans at once
      const container = document.createElement('div');
      container.style.cssText = 'visibility:hidden;position:absolute;top:0;left:0;pointer-events:none;';
      const measurements = Array.from(menuLinks).map((link) => {
        const linkText = link.textContent.trim();
        const tempSpan = document.createElement('span');
        tempSpan.style.whiteSpace = 'nowrap';
        tempSpan.style.font = window.getComputedStyle(link).font;
        tempSpan.textContent = linkText;
        container.appendChild(tempSpan);
        return { link, linkText, tempSpan };
      });
      document.body.appendChild(container);

      // Single forced layout: read all widths
      const results = measurements.map(({ link, linkText, tempSpan }) => ({
        link,
        linkText,
        textWidth: tempSpan.offsetWidth,
        availableWidth: link.offsetWidth - 20,
      }));

      // Clean up measurement container in one operation
      document.body.removeChild(container);

      // Batch DOM writes: set title attributes
      results.forEach(({ link, linkText, textWidth, availableWidth }) => {
        if (textWidth > availableWidth) {
          link.setAttribute('title', linkText);
        }
      });
    }, 500);
    return () => clearTimeout(timer);
  } catch (e) {
    console.error('Failed to enhance post menu:', e);
  }
};

/**
 * improveMenuInteraction adds persistent expansion behavior to menus.
 */
export const improveMenuInteraction = () => {
  try {
    const postMenu = document.querySelector('.post-menu');
    if (!postMenu) return;

    const parentItems = postMenu.querySelectorAll('.nav-link');
    parentItems.forEach((item) => {
      const subMenu = item.nextElementSibling;
      if (!subMenu || !subMenu.classList.contains('nav-pills')) return;

      item.addEventListener('mouseenter', () => {
        postMenu.querySelectorAll('.nav-pills .nav-pills').forEach((menu) => {
          if (!menu.querySelector('.nav-link.active')) {
            menu.classList.remove('expanded');
          }
        });

        subMenu.classList.add('expanded');
      });
    });

    postMenu.addEventListener('mouseleave', () => {
      postMenu.querySelectorAll('.nav-pills .nav-pills').forEach((menu) => {
        if (!menu.querySelector('.nav-link.active')) {
          menu.classList.remove('expanded');
        }
      });
    });

    const subMenus = postMenu.querySelectorAll('.nav-pills .nav-pills');
    subMenus.forEach((menu) => {
      menu.addEventListener('mouseenter', () => {
        menu.classList.add('expanded');
      });
    });
  } catch (e) {
    console.error('Failed to improve menu interaction:', e);
  }
};

const POST_MENU_SCROLL_OFFSET = 120;

/**
 * getScrollContext determines the scroll context (element or document).
 */
const getScrollContext = () => {
  const explicitContainer = document.querySelector('.scrollable-content');
  if (explicitContainer) {
    const canScroll = explicitContainer.scrollHeight - explicitContainer.clientHeight > 4;
    if (canScroll) {
      return {
        type: 'element',
        element: explicitContainer,
      };
    }
  }

  const docEl = document.scrollingElement || document.documentElement || document.body;
  return {
    type: 'document',
    element: docEl,
  };
};

/**
 * setupPostMenuScrollSpy sets up scroll spy for the post menu using IntersectionObserver.
 */
export const setupPostMenuScrollSpy = () => {
  try {
    const postMenu = document.querySelector('#post-menu');
    if (!postMenu || postMenu.classList.contains('is-hidden')) {
      return;
    }

    const headingSelector =
      '#post .post-content h1[id],#post .post-content h2[id],#post .post-content h3[id],#post .post-content h4[id],#post .post-content h5[id],#post .post-content h6[id]';
    const headings = Array.from(document.querySelectorAll(headingSelector));
    if (!headings.length) {
      return;
    }

    let lastActiveLink = null;

    const highlightLink = (link) => {
      if (lastActiveLink && lastActiveLink !== link) {
        lastActiveLink.classList.remove('active');
        lastActiveLink.classList.remove('is-current');
      }
      if (link) {
        link.classList.add('active');
        link.classList.add('is-current');
      }
      lastActiveLink = link || null;
    };

    const { type, element } = getScrollContext();
    const scrollElement = type === 'element' ? element : window;

    const updateActiveLink = () => {
      const rootRect = type === 'element' && element ? element.getBoundingClientRect() : { top: 0 };
      const targetLine = rootRect.top + POST_MENU_SCROLL_OFFSET + 1;

      let activeHeading = headings[0];
      for (const heading of headings) {
        const headingTop = heading.getBoundingClientRect().top;
        if (headingTop <= targetLine) {
          activeHeading = heading;
        } else {
          break;
        }
      }

      // Check if near bottom
      const isNearBottom = (() => {
        if (type === 'element' && element) {
          return element.scrollTop + element.clientHeight >= element.scrollHeight - 2;
        }
        const doc = document.documentElement;
        const body = document.body;
        const scrollTop = window.scrollY || doc.scrollTop || 0;
        const viewportHeight = window.innerHeight || doc.clientHeight;
        const scrollHeight = Math.max(doc.scrollHeight, body.scrollHeight);
        return scrollTop + viewportHeight >= scrollHeight - 2;
      })();

      if (isNearBottom) {
        activeHeading = headings[headings.length - 1];
      }

      const link = activeHeading ? postMenu.querySelector(`.nav-link[href="#${escapeSelector(activeHeading.id)}"]`) : null;
      highlightLink(link);
    };

    let rafId = null;
    const scheduleUpdate = () => {
      if (rafId !== null) {
        return;
      }
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        updateActiveLink();
      });
    };

    scheduleUpdate();

    scrollElement.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      scrollElement.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      if (lastActiveLink) {
        lastActiveLink.classList.remove('active');
        lastActiveLink.classList.remove('is-current');
      }
    };
  } catch (e) {
    console.error('failed to setup post menu scrollspy:', e);
  }
};

/**
 * escapeSelector escapes special characters in CSS selectors.
 */
const escapeSelector = (value = '') => {
  try {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }
  } catch {
    // ignore and fallback
  }

  // eslint-disable-next-line no-control-regex
  return value.replace(/[\0-\x1F\x7F-\x9F!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g, '\\$&');
};

/**
 * setupPostMenuLinkScrolling sets up smooth scrolling for menu links.
 */
export const setupPostMenuLinkScrolling = () => {
  try {
    const postMenu = document.querySelector('#post-menu');
    if (!postMenu || postMenu.classList.contains('is-hidden')) {
      return;
    }

    const { type, element } = getScrollContext();

    const handleClick = (event) => {
      const link = event.target.closest('a');
      if (!link) {
        return;
      }

      let url;
      try {
        url = new URL(link.href, window.location.href);
      } catch {
        return;
      }

      if (url.pathname !== window.location.pathname) {
        return;
      }

      const hash = url.hash;
      if (!hash) {
        return;
      }

      const target = document.querySelector(hash);
      if (!target) {
        return;
      }

      event.preventDefault();

      const targetRect = target.getBoundingClientRect();
      const offset = POST_MENU_SCROLL_OFFSET - 16;

      if (type === 'element' && element) {
        const containerRect = element.getBoundingClientRect();
        const currentScrollTop = element.scrollTop;
        const desiredScrollTop = currentScrollTop + (targetRect.top - containerRect.top) - offset;

        element.scrollTo({
          top: Math.max(desiredScrollTop, 0),
          behavior: 'smooth',
        });
      } else {
        const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
        const desiredScrollTop = scrollTop + targetRect.top - offset;

        window.scrollTo({
          top: Math.max(desiredScrollTop, 0),
          behavior: 'smooth',
        });
      }

      if (window?.history?.replaceState) {
        window.history.replaceState(null, '', hash);
      }
    };

    postMenu.addEventListener('click', handleClick);

    return () => {
      postMenu.removeEventListener('click', handleClick);
    };
  } catch (e) {
    console.error('failed to bind post menu smooth scrolling:', e);
  }
};

/**
 * setupPostMenuActiveState maintains active state for post menu links.
 */
export const setupPostMenuActiveState = () => {
  // This is now handled by setupPostMenuScrollSpy
  return () => {};
};
