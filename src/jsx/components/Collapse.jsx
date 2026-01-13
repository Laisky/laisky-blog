'use strict';

import React, { useState, useRef, useEffect } from 'react';

/**
 * Collapse component with smooth height animation.
 *
 * @param {Object} props - Component props
 * @param {boolean} [props.isOpen] - Controlled open state
 * @param {boolean} [props.defaultOpen=false] - Default open state for uncontrolled mode
 * @param {React.ReactNode} props.children - Collapsible content
 * @param {React.ReactNode} props.trigger - The element that triggers collapse toggle
 * @param {Function} [props.onToggle] - Callback when toggle state changes
 * @param {string} [props.className] - Additional CSS class
 * @param {string} [props.id] - ID for the collapse container
 * @returns {React.ReactElement} The collapse component
 */
export const Collapse = ({ isOpen: controlledIsOpen, defaultOpen = false, children, trigger, onToggle, className = '', id }) => {
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);
  const [height, setHeight] = useState(defaultOpen ? 'auto' : 0);
  const [isAnimating, setIsAnimating] = useState(false);
  const contentRef = useRef(null);

  // Determine if component is controlled
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  /**
   * toggle toggles the collapse state.
   */
  const toggle = () => {
    if (isControlled) {
      onToggle?.(!controlledIsOpen);
    } else {
      setInternalIsOpen(!internalIsOpen);
      onToggle?.(!internalIsOpen);
    }
  };

  useEffect(() => {
    if (!contentRef.current) return;

    if (isOpen) {
      // Opening: measure content height, animate from 0 to that height
      const contentHeight = contentRef.current.scrollHeight;
      setHeight(0);
      setIsAnimating(true);

      // Force reflow
      contentRef.current.offsetHeight;

      requestAnimationFrame(() => {
        setHeight(contentHeight);
      });

      // After animation, set to auto for dynamic content
      const timer = setTimeout(() => {
        setHeight('auto');
        setIsAnimating(false);
      }, 300);

      return () => clearTimeout(timer);
    } else {
      // Closing: get current height, then animate to 0
      if (height === 'auto') {
        const currentHeight = contentRef.current.scrollHeight;
        setHeight(currentHeight);
        setIsAnimating(true);

        // Force reflow
        contentRef.current.offsetHeight;

        requestAnimationFrame(() => {
          setHeight(0);
        });

        const timer = setTimeout(() => {
          setIsAnimating(false);
        }, 300);

        return () => clearTimeout(timer);
      } else {
        setHeight(0);
      }
    }
  }, [isOpen]);

  const triggerElement = trigger ? (
    <div
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      }}
      role="button"
      tabIndex={0}
      aria-expanded={isOpen}
      aria-controls={id}
      className="collapse__trigger"
    >
      {trigger}
    </div>
  ) : null;

  return (
    <div className={`collapse-container ${className}`}>
      {triggerElement}
      <div
        ref={contentRef}
        id={id}
        className={`collapse ${isOpen ? 'show' : ''} ${isAnimating ? 'collapsing' : ''}`}
        style={{
          height: typeof height === 'number' ? `${height}px` : height,
          overflow: isAnimating || !isOpen ? 'hidden' : 'visible',
          transition: isAnimating ? 'height 0.3s ease' : 'none',
        }}
        role="region"
      >
        <div className="collapse__content">{children}</div>
      </div>
    </div>
  );
};

/**
 * useCollapse hook for more control over collapse behavior.
 *
 * @param {boolean} [initialState=false] - Initial open state
 * @returns {Object} Collapse state and controls
 */
export const useCollapse = (initialState = false) => {
  const [isOpen, setIsOpen] = useState(initialState);

  const toggle = () => setIsOpen(!isOpen);
  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  return { isOpen, toggle, open, close, setIsOpen };
};

export default Collapse;
