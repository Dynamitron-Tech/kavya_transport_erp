// EnterpriseNav — Horizontal navigation strip
// Positioned below the Header, full-width, sticky, with desktop + mobile views

import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { enterpriseNavConfig } from './navConfig';
import type { NavMenuGroup, NavMenuItem } from './navConfig';
import NavItem from './NavItem';

export default function EnterpriseNav() {
  const { user, hasPermission, hasAnyRole } = useAuthStore();
  const [forceClose, setForceClose] = useState(0);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // ---- Visibility helpers ----
  const isItemVisible = useCallback(
    (item: NavMenuItem): boolean => {
      if (item.roles && !hasAnyRole(item.roles)) return false;
      if (user?.roles.includes('admin')) return true;
      if (item.permission && !hasPermission(item.permission)) return false;
      return true;
    },
    [user, hasPermission, hasAnyRole]
  );

  const isGroupVisible = useCallback(
    (group: NavMenuGroup): boolean => {
      if (group.roles && !hasAnyRole(group.roles)) return false;
      if (user?.roles.includes('admin')) return true;
      if (group.permission && !hasPermission(group.permission)) return false;
      // If it has children, at least one must be visible
      if (group.items) {
        return group.items.some(isItemVisible);
      }
      return true;
    },
    [user, hasPermission, hasAnyRole, isItemVisible]
  );

  const visibleGroups = enterpriseNavConfig.filter(isGroupVisible);

  const filteredItems = (items: NavMenuItem[]) => items.filter(isItemVisible);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setForceClose((c) => c + 1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setForceClose((c) => c + 1);
  }, [location.pathname]);

  useEffect(() => {
    setForceClose((c) => c + 1);
  }, [navigate]);

  return (
    <div ref={dropdownRef}>
      <nav
        className="hidden md:block bg-white border-b border-gray-200/80 sticky top-0 z-30 flex-shrink-0"
        aria-label="Main navigation"
      >
        <div className="flex items-center h-11 px-6 gap-0.5 overflow-x-auto enterprise-nav-scroll">
          {visibleGroups.map((group) => {
            const g = group.items
              ? { ...group, items: filteredItems(group.items) }
              : group;
            return <NavItem key={g.label} group={g} forceClose={forceClose} />;
          })}
        </div>
      </nav>
    </div>
  );
}
