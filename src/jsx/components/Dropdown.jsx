'use strict';

import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Dropdown component with toggle functionality.
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.trigger - The element that triggers the dropdown
 * @param {React.ReactNode} props.children - Dropdown menu content
 * @param {string} [props.align='start'] - Menu alignment: 'start', 'end'
 * @param {string} [props.className] - Additional CSS class
 * @param {boolean} [props.closeOnItemClick=true] - Whether to close when an item is clicked
 * @returns {React.ReactElement} The dropdown component
 */
export const Dropdown = ({
    trigger,
    children,
    align = 'start',
    className = '',
    closeOnItemClick = true,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const triggerRef = useRef(null);
    const menuRef = useRef(null);

    /**
     * handleClickOutside closes the dropdown when clicking outside.
     */
    const handleClickOutside = useCallback((event) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
            setIsOpen(false);
        }
    }, []);

    /**
     * handleKeyDown handles keyboard navigation.
     */
    const handleKeyDown = useCallback(
        (event) => {
            if (!isOpen) {
                if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
                    event.preventDefault();
                    setIsOpen(true);
                }
                return;
            }

            const menuItems = menuRef.current?.querySelectorAll(
                '[role="menuitem"], .dropdown-item'
            );
            if (!menuItems || menuItems.length === 0) return;

            const currentIndex = Array.from(menuItems).findIndex(
                (item) => item === document.activeElement
            );

            switch (event.key) {
                case 'Escape':
                    event.preventDefault();
                    setIsOpen(false);
                    triggerRef.current?.focus();
                    break;
                case 'ArrowDown':
                    event.preventDefault();
                    if (currentIndex < menuItems.length - 1) {
                        menuItems[currentIndex + 1].focus();
                    } else {
                        menuItems[0].focus();
                    }
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    if (currentIndex > 0) {
                        menuItems[currentIndex - 1].focus();
                    } else {
                        menuItems[menuItems.length - 1].focus();
                    }
                    break;
                case 'Home':
                    event.preventDefault();
                    menuItems[0].focus();
                    break;
                case 'End':
                    event.preventDefault();
                    menuItems[menuItems.length - 1].focus();
                    break;
                default:
                    break;
            }
        },
        [isOpen]
    );

    /**
     * handleMenuClick handles clicks within the menu.
     */
    const handleMenuClick = (event) => {
        if (closeOnItemClick && event.target.closest('.dropdown-item')) {
            setIsOpen(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('click', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);

            // Focus first menu item
            setTimeout(() => {
                const firstItem = menuRef.current?.querySelector(
                    '[role="menuitem"], .dropdown-item'
                );
                firstItem?.focus();
            }, 0);
        } else {
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, handleClickOutside, handleKeyDown]);

    const toggleDropdown = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(!isOpen);
    };

    return (
        <div ref={dropdownRef} className={`dropdown ${className}`}>
            <div
                ref={triggerRef}
                onClick={toggleDropdown}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        toggleDropdown(e);
                    }
                }}
                role="button"
                tabIndex={0}
                aria-haspopup="true"
                aria-expanded={isOpen}
                className="dropdown__trigger"
            >
                {trigger}
            </div>
            {isOpen && (
                <div
                    ref={menuRef}
                    className={`dropdown-menu dropdown-menu--${align} ${isOpen ? 'show' : ''}`}
                    role="menu"
                    onClick={handleMenuClick}
                >
                    {children}
                </div>
            )}
        </div>
    );
};

/**
 * DropdownItem component for dropdown menu items.
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Item content
 * @param {Function} [props.onClick] - Click handler
 * @param {boolean} [props.active=false] - Whether the item is active
 * @param {string} [props.href] - Optional href for link items
 * @param {string} [props.className] - Additional CSS class
 * @returns {React.ReactElement} The dropdown item
 */
export const DropdownItem = ({
    children,
    onClick,
    active = false,
    href,
    className = '',
    ...props
}) => {
    const handleClick = (event) => {
        onClick?.(event);
    };

    const itemClass = `dropdown-item ${active ? 'active' : ''} ${className}`;

    if (href) {
        return (
            <a href={href} className={itemClass} role="menuitem" onClick={handleClick} {...props}>
                {children}
            </a>
        );
    }

    return (
        <button
            type="button"
            className={itemClass}
            role="menuitem"
            onClick={handleClick}
            {...props}
        >
            {children}
        </button>
    );
};

export default Dropdown;
