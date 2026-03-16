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

  test('mobile + down: fully folds when post centre is well above safe zone', () => {
    const rect = { top: -300, bottom: 250, height: 550 };
    const { fadeProgress, isTop } = calculateRibbonFold({
      rect,
      viewportHeight: 900,
      navbarHeight: 52,
      isMobile: true,
      scrollDirection: 'down',
    });

    // safeTop = 52 + 90 = 142, postCentre = -25, distance = 167
    // transitionRange = max(80, 108) = 108, 167/108 > 1 → clamped to 1
    expect(isTop).toBe(true);
    expect(fadeProgress).toBe(1);
  });

  test('desktop behavior: post centre in safe zone stays fully visible', () => {
    const rect = { top: 20, bottom: 620, height: 600 };
    const { fadeProgress, isTop } = calculateRibbonFold({
      rect,
      viewportHeight: 900,
      navbarHeight: 52,
      isMobile: false,
      scrollDirection: 'down',
    });

    // safeTop = 142, safeBottom = 675, postCentre = 320 → inside reading window
    expect(isTop).toBe(false);
    expect(fadeProgress).toBe(0);
  });

  test('bottom entry fold: fully folds when post centre is well below safe zone', () => {
    const rect = { top: 860, bottom: 1160, height: 300 };
    const { fadeProgress, isTop } = calculateRibbonFold({
      rect,
      viewportHeight: 900,
      navbarHeight: 52,
      isMobile: true,
      scrollDirection: 'up',
    });

    // safeBottom = 675, postCentre = 1010, distance = 335
    // transitionRange = 108, 335/108 > 1 → clamped to 1
    expect(isTop).toBe(false);
    expect(fadeProgress).toBe(1);
  });

  test('partial fold: post centre just outside safe zone', () => {
    // Place post centre slightly above safeTop (142) by ~50px
    const rect = { top: 32, bottom: 232, height: 200 };
    const { fadeProgress, isTop } = calculateRibbonFold({
      rect,
      viewportHeight: 900,
      navbarHeight: 52,
      isMobile: true,
      scrollDirection: 'down',
    });

    // safeTop = 142, postCentre = 132, distance = 10
    // transitionRange = 108, 10/108 ≈ 0.0926
    expect(isTop).toBe(true);
    expect(fadeProgress).toBeCloseTo(0.0926, 3);
  });
});
