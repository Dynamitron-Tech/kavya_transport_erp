// DropdownMenu Component
// Renders a floating dropdown panel with menu items, shadow, rounded corners

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import type { NavMenuItem } from './navConfig';

interface DropdownMenuProps {
  items: NavMenuItem[];
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

export default function DropdownMenu({ items, anchorEl, onClose }: DropdownMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useLayoutEffect(() => {
    const updatePosition = () => {
      const el = menuRef.current;
      if (!el || !anchorEl) return;

      const viewportPadding = 8;
      const triggerRect = anchorEl.getBoundingClientRect();
      const menuWidth = el.offsetWidth || 200;

      let left = triggerRect.left;
      const top = triggerRect.bottom + 4;

      // Shift left when the menu would overflow right edge.
      if (left + menuWidth > window.innerWidth - viewportPadding) {
        left = triggerRect.right - menuWidth;
      }

      // Clamp for extreme narrow viewports.
      if (left < viewportPadding) {
        left = viewportPadding;
      }

      setCoords({ top, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [items.length, anchorEl]);

  const handleClick = (path: string) => {
    navigate(path);
    onClose();
  };

  if (!anchorEl) return null;

  return createPortal(
    <div
      ref={menuRef}
      data-enterprise-dropdown="true"
      style={{ position: 'fixed', top: coords.top, left: coords.left }}
      className="min-w-[200px] bg-white rounded-lg shadow-dropdown border border-gray-100 py-1.5 z-[100] enterprise-dropdown-enter"
      role="menu"
    >
      {items.map((item) => {
        const isActive =
          location.pathname === item.path ||
          (item.path !== '/' && location.pathname.startsWith(item.path + '/'));

        return (
          <button
            key={item.path}
            onClick={() => handleClick(item.path)}
            role="menuitem"
            className={`w-full text-left px-4 py-2 text-[13px] font-medium border-l-2 border-transparent transition-all duration-150
              ${
                isActive
                  ? 'text-primary-700 bg-blue-50 border-blue-500'
                  : 'text-gray-600 hover:text-primary-700 hover:bg-blue-50 hover:border-blue-300'
              }
            `}
          >
            {item.label}
          </button>
        );
      })}
    </div>,
    document.body
  );
}
