// NavItem Component
// A single top-level navigation item — either a direct link or dropdown trigger

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import DropdownMenu from './DropdownMenu';
import type { NavMenuGroup } from './navConfig';

interface NavItemProps {
  group: NavMenuGroup;
  /** Externally controlled open state for keyboard / mobile */
  forceClose?: number;
}

export default function NavItem({ group, forceClose }: NavItemProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const hasDropdown = !!group.items?.length;

  const GROUP_BASE_PREFIXES: Record<string, string[]> = {
    Overview: ['/dashboard'],
    Masters: ['/clients', '/vehicles', '/drivers', '/routes'],
    Operations: ['/jobs', '/lr', '/trips', '/documents', '/ewb', '/lr/eway-bill'],
    Finance: ['/finance'],
    Monitoring: ['/tracking', '/alerts'],
    Reports: ['/reports'],
    'Fleet Manager': ['/fleet'],
    Accountant: ['/accountant'],
    'My Work': ['/driver'],
  };

  const matchesPrefix = (path: string, prefix: string) =>
    path === prefix || path.startsWith(prefix + '/');

  // Close on external signal
  useEffect(() => {
    if (forceClose) setOpen(false);
  }, [forceClose]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Keyboard handler
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (hasDropdown) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setOpen((prev) => !prev);
        }
        if (e.key === 'Escape') {
          setOpen(false);
        }
      } else if (e.key === 'Enter' && group.path) {
        navigate(group.path);
      }
    },
    [hasDropdown, group.path, navigate]
  );

  // Is any child route active?
  const groupPrefixes = GROUP_BASE_PREFIXES[group.label] || [];
  const activeByGroupPrefix = groupPrefixes.some((prefix) => matchesPrefix(location.pathname, prefix));
  const activeByGroupItems = hasDropdown
    ? group.items!.some((item) => matchesPrefix(location.pathname, item.path))
    : !!(group.path && matchesPrefix(location.pathname, group.path));
  const isActive = activeByGroupPrefix || activeByGroupItems;

  const handleClick = () => {
    if (hasDropdown) {
      setOpen((prev) => !prev);
    } else if (group.path) {
      navigate(group.path);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleClick}
        onKeyDown={onKeyDown}
        aria-haspopup={hasDropdown ? 'true' : undefined}
        aria-expanded={hasDropdown ? open : undefined}
        className={`inline-flex items-center gap-1 px-3 py-2.5 text-[14px] font-medium rounded-md
          transition-all duration-150 whitespace-nowrap select-none outline-none
          focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1
          ${
            isActive
              ? 'text-primary-600'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }
        `}
      >
        <span>{group.label}</span>
        {hasDropdown && (
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${open ? 'rotate-180' : ''} ${
              isActive ? 'text-primary-500' : 'text-gray-400'
            }`}
          />
        )}
        {/* Active indicator bar */}
        {isActive && (
          <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-primary-600 rounded-full" />
        )}
      </button>

      {hasDropdown && open && (
        <DropdownMenu items={group.items!} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
