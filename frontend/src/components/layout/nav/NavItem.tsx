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
    Operations: ['/lr', '/trips', '/documents', '/ewb', '/lr/eway-bill'],
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
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-enterprise-dropdown="true"]')) {
        return;
      }
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
        className={`enterprise-nav-btn ${isActive ? 'enterprise-nav-btn-active' : ''} group inline-flex items-center gap-1 px-3 py-2.5 text-[14px] font-medium rounded-md
          border border-transparent transition-all duration-200 transform-gpu whitespace-nowrap select-none outline-none
          focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1
          ${
            isActive
              ? 'text-primary-900 bg-[rgba(30,64,175,0.18)] border-[rgba(30,64,175,0.5)] shadow-[0_14px_30px_-16px_rgba(30,58,138,0.62)] scale-[1.02]'
              : 'text-gray-700 hover:text-blue-950 active:scale-[1.02]'
          }
        `}
      >
        <span className={`${isActive ? 'text-primary-700' : 'group-hover:text-primary-700'} transition-colors duration-200`}>
          {group.label}
        </span>
        {hasDropdown && (
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${open ? 'rotate-180' : ''} ${
              isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-primary-500'
            }`}
          />
        )}
      </button>

      {hasDropdown && open && (
        <DropdownMenu
          items={group.items!}
          anchorEl={ref.current}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
