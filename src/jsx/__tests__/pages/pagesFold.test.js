import { describe, expect, test } from 'vitest';

import { calculateRibbonFold } from '../../pages/pagesFold.js';

describe('pagesFold.calculateRibbonFold', () => {
  test('mobile + down: does not fold just because top is under navbar', () => {
    const rect = { top: 20, bottom: 620, height: 600 };
    const { fadeProgress, isTop } = calculateRibbonFold({
      rect,
      viewportHeight: 900,
      navbarHeight: 52,
      isMobile: true,
      scrollDirection: 'down',
    });

    expect(isTop).toBe(false);
    expect(fadeProgress).toBe(0);
  });

  test('mobile + down: starts folding when bottom passes 1/3 viewport height', () => {
    const rect = { top: -300, bottom: 250, height: 550 };
    const { fadeProgress, isTop } = calculateRibbonFold({
      rect,
      viewportHeight: 900,
      navbarHeight: 52,
      isMobile: true,
      scrollDirection: 'down',
    });

    // Trigger line = 300, transition range = 140 => (300-250)/140 ~= 0.357
    expect(isTop).toBe(true);
    expect(fadeProgress).toBeCloseTo(0.357, 3);
  });

  test('desktop behavior: folds progressively when top slides under navbar', () => {
    const rect = { top: 20, bottom: 620, height: 600 };
    const { fadeProgress, isTop } = calculateRibbonFold({
      rect,
      viewportHeight: 900,
      navbarHeight: 52,
      isMobile: false,
      scrollDirection: 'down',
    });

    // visibleHeight = 620-52=568; hiddenRatio=1-568/600=0.0533; *1.5=0.08
    expect(isTop).toBe(true);
    expect(fadeProgress).toBeCloseTo(0.08, 2);
  });

  test('bottom entry fold: folds when top is near the bottom edge', () => {
    const rect = { top: 860, bottom: 1160, height: 300 };
    const { fadeProgress, isTop } = calculateRibbonFold({
      rect,
      viewportHeight: 900,
      navbarHeight: 52,
      isMobile: true,
      scrollDirection: 'up',
    });

    // bottomZoneStart = 800, range = 80 => (860-800)/80=0.75
    expect(isTop).toBe(false);
    expect(fadeProgress).toBeCloseTo(0.75, 3);
  });
});
