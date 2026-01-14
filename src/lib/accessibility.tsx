/**
 * Accessibility utilities and hooks
 * Provides focus management, keyboard navigation, and screen reader support
 */

import React, { useEffect, useCallback, useRef, useState, ReactNode } from 'react';

// Focus trap for modals
export const useFocusTrap = (isActive: boolean) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element when trap is activated
    firstElement?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);

  return containerRef;
};

// Restore focus after modal closes
export const useRestoreFocus = (isOpen: boolean) => {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
    } else if (previousActiveElement.current) {
      previousActiveElement.current.focus();
      previousActiveElement.current = null;
    }
  }, [isOpen]);
};

// Keyboard navigation for lists/grids
export const useKeyboardNavigation = <T extends HTMLElement>(
  items: T[],
  options: {
    orientation?: 'horizontal' | 'vertical' | 'grid';
    gridColumns?: number;
    loop?: boolean;
    onSelect?: (index: number) => void;
  } = {}
) => {
  const {
    orientation = 'vertical',
    gridColumns = 1,
    loop = true,
    onSelect,
  } = options;

  const [currentIndex, setCurrentIndex] = useState(0);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (items.length === 0) return;

      let newIndex = currentIndex;
      const isHorizontal = orientation === 'horizontal' || orientation === 'grid';
      const isVertical = orientation === 'vertical' || orientation === 'grid';

      switch (e.key) {
        case 'ArrowRight':
          if (isHorizontal) {
            e.preventDefault();
            newIndex = currentIndex + 1;
          }
          break;
        case 'ArrowLeft':
          if (isHorizontal) {
            e.preventDefault();
            newIndex = currentIndex - 1;
          }
          break;
        case 'ArrowDown':
          if (isVertical) {
            e.preventDefault();
            newIndex = orientation === 'grid'
              ? currentIndex + gridColumns
              : currentIndex + 1;
          }
          break;
        case 'ArrowUp':
          if (isVertical) {
            e.preventDefault();
            newIndex = orientation === 'grid'
              ? currentIndex - gridColumns
              : currentIndex - 1;
          }
          break;
        case 'Home':
          e.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          newIndex = items.length - 1;
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          onSelect?.(currentIndex);
          return;
        default:
          return;
      }

      // Handle bounds
      if (loop) {
        if (newIndex < 0) newIndex = items.length - 1;
        if (newIndex >= items.length) newIndex = 0;
      } else {
        newIndex = Math.max(0, Math.min(items.length - 1, newIndex));
      }

      setCurrentIndex(newIndex);
      items[newIndex]?.focus();
    },
    [currentIndex, items, orientation, gridColumns, loop, onSelect]
  );

  return { currentIndex, setCurrentIndex, handleKeyDown };
};

// Skip link for keyboard users
export const SkipLink: React.FC<{ targetId: string; children: React.ReactNode }> = ({
  targetId,
  children,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      className="skip-link"
      onClick={handleClick}
      style={{
        position: 'absolute',
        left: '-10000px',
        top: 'auto',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
      }}
      onFocus={(e) => {
        const el = e.currentTarget;
        el.style.left = '10px';
        el.style.top = '10px';
        el.style.width = 'auto';
        el.style.height = 'auto';
        el.style.overflow = 'visible';
        el.style.zIndex = '10000';
        el.style.padding = '8px 16px';
        el.style.background = '#3b82f6';
        el.style.color = 'white';
        el.style.borderRadius = '4px';
        el.style.textDecoration = 'none';
      }}
      onBlur={(e) => {
        const el = e.currentTarget;
        el.style.left = '-10000px';
        el.style.width = '1px';
        el.style.height = '1px';
        el.style.overflow = 'hidden';
      }}
    >
      {children}
    </a>
  );
};

// Announce to screen readers
export const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  const announcerId = `announcer-${priority}`;
  let announcer = document.getElementById(announcerId);

  if (!announcer) {
    announcer = document.createElement('div');
    announcer.id = announcerId;
    announcer.setAttribute('aria-live', priority);
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    announcer.style.cssText = 'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;';
    document.body.appendChild(announcer);
  }

  // Clear and set message for announcement
  announcer.textContent = '';
  setTimeout(() => {
    announcer!.textContent = message;
  }, 100);
};

// Hook for live region announcements
export const useAnnounce = () => {
  return useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    announce(message, priority);
  }, []);
};

// Detect reduced motion preference
export const usePrefersReducedMotion = (): boolean => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
};

// High contrast mode detection
export const usePrefersHighContrast = (): boolean => {
  const [prefersHighContrast, setPrefersHighContrast] = useState(
    () => window.matchMedia('(prefers-contrast: more)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: more)');
    const handler = (e: MediaQueryListEvent) => setPrefersHighContrast(e.matches);

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersHighContrast;
};

// Generate unique IDs for ARIA attributes
let idCounter = 0;
export const useId = (prefix = 'id'): string => {
  const idRef = useRef<string>();
  if (!idRef.current) {
    idRef.current = `${prefix}-${++idCounter}`;
  }
  return idRef.current;
};

// Visible focus styles helper
export const focusRingStyles = {
  outline: '2px solid #3b82f6',
  outlineOffset: '2px',
};

// Common ARIA attributes for interactive elements
export const getButtonAriaProps = (
  label: string,
  options: {
    pressed?: boolean;
    expanded?: boolean;
    controls?: string;
    describedBy?: string;
    disabled?: boolean;
  } = {}
) => ({
  'aria-label': label,
  ...(options.pressed !== undefined && { 'aria-pressed': options.pressed }),
  ...(options.expanded !== undefined && { 'aria-expanded': options.expanded }),
  ...(options.controls && { 'aria-controls': options.controls }),
  ...(options.describedBy && { 'aria-describedby': options.describedBy }),
  ...(options.disabled && { 'aria-disabled': true }),
});

export default {
  useFocusTrap,
  useRestoreFocus,
  useKeyboardNavigation,
  SkipLink,
  announce,
  useAnnounce,
  usePrefersReducedMotion,
  usePrefersHighContrast,
  useId,
  focusRingStyles,
  getButtonAriaProps,
};
