'use strict';

import React from 'react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import Modal from '../../components/Modal';

const scssDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../scss');

/**
 * compileModalCss compiles the modal component stylesheet and returns the
 * generated CSS as a single whitespace-normalized string, so tests can assert
 * on the rules that are actually shipped to the browser.
 */
const compileModalCss = () =>
  sass
    .compile(path.join(scssDir, 'components/modal.scss'), { loadPaths: [scssDir] })
    .css.replace(/\s+/g, ' ');

/**
 * findRule returns the declaration block of the first rule whose selector list
 * matches the given selector exactly, or an empty string when it is absent.
 */
const findRule = (css, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(?:^|})\\s*${escaped}\\s*{([^}]*)}`));
  return match ? match[1] : '';
};

describe('Modal', () => {
  test('applies the requested size class so the image viewer can fill the viewport', () => {
    render(
      <Modal isOpen onClose={() => {}} size="fullscreen" className="modal--image">
        <img src="/img.png" alt="Enlarged" />
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('modal--fullscreen');
    expect(dialog).toHaveClass('modal--image');
  });

  test('closes when the modal body itself is clicked and closeOnContentClick is set', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} size="fullscreen" className="modal--image" closeOnContentClick>
        <img src="/img.png" alt="Enlarged" />
      </Modal>
    );

    fireEvent.click(screen.getByRole('img', { name: 'Enlarged' }));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('dialog').querySelector('.modal__body'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('keeps body clicks inert by default', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Settings">
        <p>content</p>
      </Modal>
    );

    fireEvent.click(document.querySelector('.modal__body'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('image modal stylesheet', () => {
  const css = compileModalCss();

  test('does not cap the image modal below the viewport size', () => {
    const rule = findRule(css, '.modal--image');
    expect(rule).toMatch(/max-width: none/);
    expect(rule).toMatch(/max-height: none/);
  });

  test('keeps the whole image reachable when it overflows the viewport', () => {
    const body = findRule(css, '.modal--image .modal__body');
    expect(body).toMatch(/overflow: auto/);
    // Flex centering pushes an oversized item past the scroll container's
    // start edge, making the image's top-left corner unreachable.
    expect(body).not.toMatch(/justify-content: center/);
    expect(body).not.toMatch(/align-items: center/);

    const image = findRule(css, '.modal--image img');
    expect(image).toMatch(/margin: auto/);
    expect(image).toMatch(/max-width: none/);
    expect(image).toMatch(/max-height: none/);
  });
});
