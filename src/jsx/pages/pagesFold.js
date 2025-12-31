'use strict';

/**
 * clamp01 clamps a number into the inclusive range [0, 1].
 *
 * @param {number} value - Any numeric value.
 * @returns {number} The clamped value.
 */
export const clamp01 = (value) => Math.min(1, Math.max(0, value));

/**
 * calculateRibbonFold determines the fold progress for a single post.
 *
 * This is intentionally a pure function so the visual behavior can be unit-tested.
 *
 * Mobile behavior change (requested):
 * - When scrolling down, the top fold is triggered by the post's bottom edge.
 *   The fold starts once the bottom passes 1/3 of the viewport height.
 * - When scrolling up, we keep the original "top-edge under navbar" driven fold,
 *   which makes the fold/unfold feel responsive and consistent.
 *
 * @param {Object} input - Calculation input.
 * @param {{top:number,bottom:number,height:number}} input.rect - Bounding rect of the post.
 * @param {number} input.viewportHeight - Window inner height.
 * @param {number} input.navbarHeight - Fixed navbar height.
 * @param {boolean} input.isMobile - Whether to use mobile rules.
 * @param {'up'|'down'} input.scrollDirection - Current scroll direction.
 * @returns {{fadeProgress:number,isTop:boolean}} Fold progress and whether it folds toward the top.
 */
export const calculateRibbonFold = ({
    rect,
    viewportHeight,
    navbarHeight,
    isMobile,
    scrollDirection,
}) => {
    // Bottom-entry fold: keep existing reel feel (applies on all viewports).
    const bottomZoneStart = viewportHeight - 100;
    const bottomTransitionRange = 80;

    // Top fold (mobile) uses a bottom-edge trigger when scrolling down.
    const topTriggerLine = viewportHeight / 3;
    const topTransitionRange = Math.min(140, Math.max(90, Math.round(viewportHeight * 0.18)));

    // Calculate how much of the post is visible/faded
    let fadeProgress = 0; // 0 = fully visible, 1 = fully folded
    let isTop = false;

    // Hard-stop: completely above the navbar.
    if (rect.bottom <= navbarHeight) {
        return { fadeProgress: 1, isTop: true };
    }

    // Top fold behavior
    if (isMobile && scrollDirection === 'down') {
        // Delay the top fold for long articles: start only after the bottom rises above 1/3 viewport.
        if (rect.bottom < topTriggerLine) {
            const progress = (topTriggerLine - rect.bottom) / topTransitionRange;
            fadeProgress = clamp01(progress);
            isTop = true;
        }
    } else {
        // Original behavior: fold when the top slides under the navbar.
        if (rect.top < navbarHeight && rect.bottom > navbarHeight && rect.height > 0) {
            const visibleHeight = rect.bottom - navbarHeight;
            const hiddenRatio = 1 - visibleHeight / rect.height;
            fadeProgress = clamp01(hiddenRatio * 1.5);
            isTop = true;
        }
    }

    // Bottom fold behavior (entering/leaving at bottom edge of the viewport).
    if (fadeProgress <= 0 && rect.top > bottomZoneStart) {
        const distanceFromSafeZone = rect.top - bottomZoneStart;
        fadeProgress = clamp01(distanceFromSafeZone / bottomTransitionRange);
        isTop = false;
    }

    return { fadeProgress, isTop };
};
