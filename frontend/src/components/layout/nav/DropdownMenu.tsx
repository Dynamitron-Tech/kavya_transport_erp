// DropdownMenu Component
// Renders a floating dropdown panel with menu items, shadow, rounded corners

import { useNavigate, useLocation } from 'react-router-dom';
import type { NavMenuItem } from './navConfig';

interface DropdownMenuProps {
  items: NavMenuItem[];
  onClose: () => void;
}

export default function DropdownMenu({ items, onClose }: DropdownMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <div
      className="absolute top-full left-0 mt-1 min-w-[200px] bg-white rounded-lg shadow-dropdown
        border border-gray-100 py-1.5 z-50 enterprise-dropdown-enter"
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
            className={`w-full text-left px-4 py-2 text-[13px] font-medium transition-colors duration-150
              ${
                isActive
                  ? 'text-primary-600 bg-primary-50/60'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }
            `}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
