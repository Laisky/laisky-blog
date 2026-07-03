'use strict';

/**
 * clamp01 clamps a number into the inclusive range [0, 1].
 *
 * @param {number} value - Any numeric value.
 * @returns {number} The clamped value.
 */
export const clamp01 = (value) => Math.min(1, Math.max(0, value));

/**
 * calculateRibbonFold determines the fold progress for a single post
 * using a punch-card / paper-tape metaphor.
 *
 * The viewport is divided into three conceptual zones:
 *   - Centre "reading window": the post here is fully flat and readable.
 *   - Upper fold zone: posts above the window fold upward (like a card
 *     flipping away from the reader at its bottom edge).
 *   - Lower fold zone: posts below the window fold downward (like a card
 *     flipping toward the reader at its top edge).
 *
 * @param {Object} input
 * @param {{top:number,bottom:number,height:number}} input.rect
 * @param {number} input.viewportHeight
 * @param {number} input.navbarHeight
 * @param {boolean} input.isMobile
 * @returns {{fadeProgress:number, isTop:boolean}}
 */
export const calculateRibbonFold = ({ rect, viewportHeight, navbarHeight, isMobile }) => {
  // The "safe" reading window: the central portion of the viewport
  // where the active card stays completely flat.
  const safeTop = navbarHeight + viewportHeight * 0.1;
  const safeBottom = viewportHeight * 0.75;

  // Transition range (pixels) over which the fold animates from 0 → 1.
  const transitionRange = isMobile ? Math.max(80, viewportHeight * 0.12) : Math.max(100, viewportHeight * 0.15);

  // --- Hard stop: completely above navbar ---
  if (rect.bottom <= navbarHeight) {
    return { fadeProgress: 1, isTop: true };
  }

  // --- Hard stop: completely below viewport ---
  if (rect.top >= viewportHeight) {
    return { fadeProgress: 1, isTop: false };
  }

  // --- Upper fold zone ---
  // The post's vertical centre relative to the safe zone top.
  const postCentre = (rect.top + rect.bottom) / 2;

  if (postCentre < safeTop) {
    const distance = safeTop - postCentre;
    return {
      fadeProgress: clamp01(distance / transitionRange),
      isTop: true,
    };
  }

  // --- Lower fold zone ---
  if (postCentre > safeBottom) {
    const distance = postCentre - safeBottom;
    return {
      fadeProgress: clamp01(distance / transitionRange),
      isTop: false,
    };
  }

  // --- Inside the reading window: fully visible ---
  return { fadeProgress: 0, isTop: false };
};
