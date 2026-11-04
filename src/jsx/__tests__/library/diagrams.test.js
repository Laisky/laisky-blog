'use strict';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mermaidMock = vi.hoisted(() => ({ initialize: vi.fn(), run: vi.fn(async () => {}) }));
vi.mock('mermaid', () => ({ default: mermaidMock }));

/** loadDiagrams imports a fresh copy of the diagram module so its one-time configuration state starts unset. */
const loadDiagrams = async () => {
  vi.resetModules();
  return import('../../library/diagrams.js');
};

beforeEach(() => {
  mermaidMock.initialize.mockClear();
  mermaidMock.run.mockReset();
  mermaidMock.run.mockImplementation(async () => {});
});

describe('article diagram rendering', () => {
  it('pins the Mermaid 11 layout, theme and look that published diagrams were authored against', async () => {
    const { DIAGRAM_CONFIG } = await loadDiagrams();
    expect(DIAGRAM_CONFIG).toEqual({
      layout: 'dagre',
      theme: 'default',
      look: 'classic',
      flowchart: { wrappingWidth: 200, minNodeWidth: 0 },
      state: { wrappingWidth: 200, minNodeWidth: 0 },
    });
    expect([DIAGRAM_CONFIG, DIAGRAM_CONFIG.flowchart, DIAGRAM_CONFIG.state].every(Object.isFrozen)).toBe(true);
  });

  it('does not touch Mermaid global state on import', async () => {
    await loadDiagrams();
    expect(mermaidMock.initialize).not.toHaveBeenCalled();
    expect(mermaidMock.run).not.toHaveBeenCalled();
  });

  it('configures Mermaid once, before the first render, and renders exactly the given nodes', async () => {
    const { DIAGRAM_CONFIG, renderDiagrams } = await loadDiagrams();
    const first = [document.createElement('pre')];
    const second = [document.createElement('pre')];

    await renderDiagrams(first);
    await renderDiagrams(second);

    expect(mermaidMock.initialize).toHaveBeenCalledTimes(1);
    expect(mermaidMock.initialize).toHaveBeenCalledWith(DIAGRAM_CONFIG);
    expect(mermaidMock.initialize.mock.invocationCallOrder[0]).toBeLessThan(mermaidMock.run.mock.invocationCallOrder[0]);
    expect(mermaidMock.run.mock.calls).toEqual([[{ nodes: first }], [{ nodes: second }]]);
  });

  it('surfaces a render failure to the caller', async () => {
    const { renderDiagrams } = await loadDiagrams();
    mermaidMock.run.mockRejectedValueOnce(new Error('Parse error on line 1'));

    await expect(renderDiagrams([])).rejects.toThrow('Parse error on line 1');
  });
});
