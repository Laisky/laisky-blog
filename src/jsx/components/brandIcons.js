'use strict';

import { createLucideIcon } from 'lucide-react';

/**
 * GITHUB_ICON_NODE is the outline GitHub mark that lucide-react shipped up to 0.554.0.
 * Lucide 1.0 dropped brand icons, so the blog keeps this ISC-licensed drawing locally
 * to render the same link icons as before the upgrade.
 */
const GITHUB_ICON_NODE = [
  [
    'path',
    {
      d: 'M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4',
      key: 'tonef',
    },
  ],
  ['path', { d: 'M9 18c-4.51 2-5-2-7-2', key: '9comsn' }],
];

/**
 * TWITTER_ICON_NODE is the outline Twitter bird that lucide-react shipped up to 0.554.0,
 * kept locally for the same reason as GITHUB_ICON_NODE.
 */
const TWITTER_ICON_NODE = [
  [
    'path',
    {
      d: 'M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z',
      key: 'pff0z6',
    },
  ],
];

/**
 * Github is a lucide-compatible icon component that accepts the usual lucide props
 * (size, color, strokeWidth, className, ...) and returns the GitHub outline SVG with the
 * `lucide lucide-github` classes, so existing `.lucide` styles still apply.
 */
export const Github = createLucideIcon('github', GITHUB_ICON_NODE);

/**
 * Twitter is a lucide-compatible icon component that accepts the usual lucide props and
 * returns the Twitter bird outline SVG with the `lucide lucide-twitter` classes.
 */
export const Twitter = createLucideIcon('twitter', TWITTER_ICON_NODE);
