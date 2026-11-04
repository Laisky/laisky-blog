'use strict';

import mermaid from 'mermaid';

/**
 * DIAGRAM_CONFIG pins the Mermaid appearance that published articles were authored against.
 *
 * Mermaid 12 changed its defaults: diagrams lay out with ELK instead of dagre, most diagram
 * types (flowchart, sequence, class, state, ER, ...) switched to the `redux-color` theme with the
 * `neo` look, and flowchart/state nodes gained a 120px minimum width with labels wrapping at 120px
 * instead of 200px. Values passed to `mermaid.initialize` take precedence over those per-diagram
 * defaults, so these keep the Mermaid 11 rendering (same layout and node sizes); an article's own
 * front matter or `%%{init}%%` directive still wins. Dagre also keeps the lazily loaded ELK engine
 * out of ordinary articles: ELK assigns `toString` on prototypes and throws when
 * `Object.prototype.toString` is read-only, the hardened realm the startup repairs target.
 */
export const DIAGRAM_CONFIG = Object.freeze({
  layout: 'dagre',
  theme: 'default',
  look: 'classic',
  flowchart: Object.freeze({ wrappingWidth: 200, minNodeWidth: 0 }),
  state: Object.freeze({ wrappingWidth: 200, minNodeWidth: 0 }),
});

let configured = false;

/**
 * renderDiagrams renders the given Mermaid source nodes with DIAGRAM_CONFIG.
 *
 * The configuration is applied once, right before the first render, so importing this module
 * has no side effects on Mermaid's global state.
 *
 * @param {NodeListOf<HTMLElement>|HTMLElement[]} nodes - Elements whose text is Mermaid source.
 * @returns {Promise<void>} Resolves when Mermaid has rendered every node; rejects on a render error.
 */
export const renderDiagrams = async (nodes) => {
  if (!configured) {
    mermaid.initialize(DIAGRAM_CONFIG);
    configured = true;
  }
  await mermaid.run({ nodes });
};
