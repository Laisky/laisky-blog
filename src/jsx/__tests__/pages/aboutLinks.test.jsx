'use strict';

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, test } from 'vitest';

import { Github, Twitter } from '../../components/brandIcons';
import { About } from '../../pages/about';

/**
 * renderAbout renders the About page for one tab inside a memory router and
 * returns the Testing Library render result.
 */
const renderAbout = (tab) =>
  render(
    <MemoryRouter initialEntries={[`/about/${tab}/`]}>
      <Routes>
        <Route path="/about/:tab/" element={<About />} />
      </Routes>
    </MemoryRouter>
  );

/**
 * iconOf returns the decorative SVG icon rendered inside the social link with
 * the given accessible name.
 */
const iconOf = (name) => screen.getByRole('link', { name }).querySelector('svg');

describe('About page social links', () => {
  test('keeps the GitHub icon on both repository links of the site tab', () => {
    renderAbout('site');

    for (const name of ['Backend Repo', 'GraphQL Repo']) {
      const icon = iconOf(name);
      expect(icon).toHaveClass('lucide', 'lucide-github');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect(icon).toHaveAttribute('width', '18');
    }
  });

  test('keeps the GitHub and Twitter icons on the profile links of the me tab', () => {
    renderAbout('me');

    expect(iconOf('GitHub')).toHaveClass('lucide', 'lucide-github');
    expect(iconOf('Twitter/X')).toHaveClass('lucide', 'lucide-twitter');
    expect(iconOf('Email')).toHaveClass('lucide', 'lucide-mail');
  });
});

describe('local brand icons', () => {
  test.each([
    ['Github', Github, 2],
    ['Twitter', Twitter, 1],
  ])('%s accepts the standard lucide props and draws its outline', (_name, Icon, paths) => {
    const { container } = render(<Icon size={24} strokeWidth={1.5} className="extra" />);
    const icon = container.querySelector('svg');

    expect(icon).toHaveClass('lucide', 'extra');
    expect(icon).toHaveAttribute('viewBox', '0 0 24 24');
    expect(icon).toHaveAttribute('stroke', 'currentColor');
    expect(icon).toHaveAttribute('stroke-width', '1.5');
    expect(icon).toHaveAttribute('width', '24');
    expect(icon.querySelectorAll('path')).toHaveLength(paths);
  });
});
