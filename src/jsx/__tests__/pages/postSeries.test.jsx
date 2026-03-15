'use strict';

import parse from 'html-react-parser';
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for the post_series key attribute handling.
 *
 * Background: markdown content contains <div class="post_series" key="golang"></div>.
 * React treats "key" as a reserved prop and strips it from the DOM output.
 * The fix converts "key" to "data-series-key" during html-react-parser processing,
 * so parseAndReplacePostSeries() can read the series key from the rendered DOM.
 */

/**
 * Creates parseOptions matching the production implementation in post.jsx.
 * This duplicates the post_series-related replace logic so we can test it in isolation.
 */
const createParseOptions = () => ({
  replace: (domNode) => {
    if (domNode.name === 'div' && domNode.attribs?.class?.includes('post_series') && domNode.attribs?.key) {
      domNode.attribs['data-series-key'] = domNode.attribs.key;
      delete domNode.attribs.key;
    }
  },
});

describe('post_series key attribute handling', () => {
  describe('html-react-parser with parseOptions', () => {
    test('converts key attribute to data-series-key for post_series divs', () => {
      const html = '<div class="post_series" key="golang"></div>';
      const parseOptions = createParseOptions();
      const { container } = render(<div>{parse(html, parseOptions)}</div>);

      const el = container.querySelector('div.post_series');
      expect(el).not.toBeNull();
      expect(el.getAttribute('data-series-key')).toBe('golang');
      // React should NOT have rendered a "key" attribute on the DOM element
      expect(el.getAttribute('key')).toBeNull();
    });

    test('preserves data-series-key with various key values', () => {
      const keys = ['golang', 'python-advanced', 'web_dev_101', 'rust'];
      const parseOptions = createParseOptions();

      for (const key of keys) {
        const html = `<div class="post_series" key="${key}"></div>`;
        const { container } = render(<div>{parse(html, parseOptions)}</div>);
        const el = container.querySelector('div.post_series');
        expect(el.getAttribute('data-series-key')).toBe(key);
      }
    });

    test('does NOT modify key attribute on non-post_series elements', () => {
      const html = '<div class="other" key="something"></div>';
      const parseOptions = createParseOptions();
      // html-react-parser treats "key" as React prop, so it won't appear in DOM
      // but our replace function should NOT touch non-post_series elements
      const { container } = render(<div>{parse(html, parseOptions)}</div>);
      const el = container.querySelector('div.other');
      expect(el).not.toBeNull();
      // "key" is still consumed by React, so it won't be in the DOM
      expect(el.getAttribute('data-series-key')).toBeNull();
    });

    test('handles post_series div without key attribute gracefully', () => {
      const html = '<div class="post_series"></div>';
      const parseOptions = createParseOptions();
      const { container } = render(<div>{parse(html, parseOptions)}</div>);
      const el = container.querySelector('div.post_series');
      expect(el).not.toBeNull();
      expect(el.getAttribute('data-series-key')).toBeNull();
    });

    test('handles post_series div with data-series-key already set (new format)', () => {
      const html = '<div class="post_series" data-series-key="golang"></div>';
      const parseOptions = createParseOptions();
      const { container } = render(<div>{parse(html, parseOptions)}</div>);
      const el = container.querySelector('div.post_series');
      expect(el).not.toBeNull();
      expect(el.getAttribute('data-series-key')).toBe('golang');
    });

    test('preserves other attributes on post_series div when converting key', () => {
      const html = '<div class="post_series" key="golang" id="my-series" data-extra="test"></div>';
      const parseOptions = createParseOptions();
      const { container } = render(<div>{parse(html, parseOptions)}</div>);
      const el = container.querySelector('div.post_series');
      expect(el.getAttribute('data-series-key')).toBe('golang');
      expect(el.getAttribute('id')).toBe('my-series');
      expect(el.getAttribute('data-extra')).toBe('test');
    });

    test('handles mixed content with post_series and other elements', () => {
      const html = `
        <p>Some text</p>
        <div class="post_series" key="golang"></div>
        <p>More text</p>
      `;
      const parseOptions = createParseOptions();
      const { container } = render(<div>{parse(html, parseOptions)}</div>);
      const el = container.querySelector('div.post_series');
      expect(el.getAttribute('data-series-key')).toBe('golang');
      // Verify other content is intact
      const paragraphs = container.querySelectorAll('p');
      expect(paragraphs).toHaveLength(2);
    });
  });

  describe('parseAndReplacePostSeries DOM reading', () => {
    /**
     * Simulates the DOM reading logic from parseAndReplacePostSeries().
     * Tests that the function can find the series key from rendered elements.
     */

    beforeEach(() => {
      // Create a container matching the DOM structure expected by parseAndReplacePostSeries
      const postDiv = document.createElement('div');
      postDiv.className = 'post';
      const contentDiv = document.createElement('div');
      contentDiv.className = 'post-content';
      postDiv.appendChild(contentDiv);
      document.body.appendChild(postDiv);
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    test('reads data-series-key from DOM element (fixed format)', () => {
      const contentDiv = document.querySelector('.post .post-content');
      const seriesDiv = document.createElement('div');
      seriesDiv.className = 'post_series';
      seriesDiv.setAttribute('data-series-key', 'golang');
      contentDiv.appendChild(seriesDiv);

      const elements = document.querySelectorAll('.post .post-content div.post_series');
      expect(elements).toHaveLength(1);

      const postkey = elements[0].getAttribute('data-series-key') || elements[0].getAttribute('key');
      expect(postkey).toBe('golang');
    });

    test('falls back to key attribute for backward compatibility', () => {
      const contentDiv = document.querySelector('.post .post-content');
      const seriesDiv = document.createElement('div');
      seriesDiv.className = 'post_series';
      // Directly set key attribute on DOM (simulates server-rendered content)
      seriesDiv.setAttribute('key', 'python');
      contentDiv.appendChild(seriesDiv);

      const elements = document.querySelectorAll('.post .post-content div.post_series');
      const postkey = elements[0].getAttribute('data-series-key') || elements[0].getAttribute('key');
      expect(postkey).toBe('python');
    });

    test('returns null when neither attribute is present', () => {
      const contentDiv = document.querySelector('.post .post-content');
      const seriesDiv = document.createElement('div');
      seriesDiv.className = 'post_series';
      contentDiv.appendChild(seriesDiv);

      const elements = document.querySelectorAll('.post .post-content div.post_series');
      const postkey = elements[0].getAttribute('data-series-key') || elements[0].getAttribute('key');
      expect(postkey).toBeNull();
    });

    test('handles multiple post_series elements on the same page', () => {
      const contentDiv = document.querySelector('.post .post-content');

      const series1 = document.createElement('div');
      series1.className = 'post_series';
      series1.setAttribute('data-series-key', 'golang');
      contentDiv.appendChild(series1);

      const series2 = document.createElement('div');
      series2.className = 'post_series';
      series2.setAttribute('data-series-key', 'rust');
      contentDiv.appendChild(series2);

      const elements = document.querySelectorAll('.post .post-content div.post_series');
      expect(elements).toHaveLength(2);

      const keys = Array.from(elements).map((el) => el.getAttribute('data-series-key') || el.getAttribute('key'));
      expect(keys).toEqual(['golang', 'rust']);
    });
  });

  describe('end-to-end: html-react-parser → DOM read', () => {
    test('key attribute survives the full pipeline (parse → render → DOM read)', () => {
      const html = '<div class="post_series" key="golang"></div>';
      const parseOptions = createParseOptions();

      // Step 1: Parse and render into DOM (simulating what post.jsx does)
      const { container } = render(
        <div className="post">
          <div className="post-content">{parse(html, parseOptions)}</div>
        </div>
      );

      // Step 2: Query the DOM (simulating what parseAndReplacePostSeries does)
      const elements = container.querySelectorAll('.post .post-content div.post_series');
      expect(elements).toHaveLength(1);

      const postkey = elements[0].getAttribute('data-series-key') || elements[0].getAttribute('key');
      expect(postkey).toBe('golang');
    });

    test('without fix: React strips key attribute from DOM (demonstrating the original bug)', () => {
      const html = '<div class="post_series" key="golang"></div>';
      // Parse WITHOUT the fix — no custom replace
      const { container } = render(
        <div className="post">
          <div className="post-content">{parse(html)}</div>
        </div>
      );

      const el = container.querySelector('.post .post-content div.post_series');
      expect(el).not.toBeNull();
      // Without the fix, neither attribute is present
      expect(el.getAttribute('key')).toBeNull();
      expect(el.getAttribute('data-series-key')).toBeNull();
    });
  });
});
