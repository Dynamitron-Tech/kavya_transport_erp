// Enterprise Navigation Configuration
// Defines the horizontal nav menu structure with role-based visibility

import type { RoleType } from '@/types';

export interface NavMenuItem {
  label: string;
  path: string;
  route?: string;
  icon?: string;
  description?: string;
  permission?: string;
  roles?: RoleType[];
}

export interface NavMenuGroup {
  label: string;
  path?: string;              // direct link (no dropdown)
  items?: NavMenuItem[];      // dropdown children
  permission?: string;
  roles?: RoleType[];
}

export type HeaderNavRole = 'ADMIN' | 'MANAGER' | 'FLEET_MANAGER' | 'ACCOUNTANT' | 'PROJECT_ASSOCIATES' | 'DRIVER' | 'PUMP_OPERATOR';

export interface HeaderNavItem {
  label: string;
  route: string;
  icon: string;
  description: string;
}

export interface HeaderNavSection {
  label: string;
  items: HeaderNavItem[];
}

export const NAV_CONFIG: Record<HeaderNavRole, { sections: HeaderNavSection[] }> = {
  ADMIN: {
    sections: [
      { label: 'Overview', items: [{ label: 'Dashboard', route: '/dashboard', icon: 'home', description: 'Company overview and quick KPIs' }] },
      {
        label: 'Masters',
        items: [
          { label: 'Clients', route: '/clients', icon: 'users', description: 'Manage client records and contacts' },
          { label: 'Vehicles', route: '/vehicles', icon: 'truck', description: 'Fleet vehicle inventory and documents' },
          { label: 'Drivers', route: '/drivers', icon: 'id', description: 'Driver profiles, licences and compliance' },
          { label: 'Driver Dashboard', route: '/drivers/dashboard', icon: 'dashboard', description: 'Driver performance dashboard' },
          { label: 'Routes', route: '/routes', icon: 'route', description: 'Route master and distance definitions' },
          { label: 'Suppliers', route: '/suppliers', icon: 'truck', description: 'Manage supplier/contractor records' },
        ],
      },
      {
        label: 'Operations',
        items: [
          { label: 'Jobs / Orders', route: '/jobs', icon: 'briefcase', description: 'Create and assign transport jobs' },
          { label: 'Market Trips', route: '/market-trips', icon: 'truck', description: 'Hired truck trips and P&L' },
          { label: 'Lorry Receipts', route: '/lr', icon: 'file', description: 'Generate and manage LR documents' },
          { label: 'Trips', route: '/trips', icon: 'map', description: 'Trip execution and monitoring' },
          { label: 'Documents', route: '/documents', icon: 'folder', description: 'Upload and manage documents' },
        ],
      },
      {
        label: 'Finance',
        items: [
          { label: 'Finance Dashboard', route: '/accountant', icon: 'gauge', description: 'Financial overview and KPIs' },
          { label: 'Invoices', route: '/finance/invoices', icon: 'invoice', description: 'GST invoices and billing' },
          { label: 'Payments', route: '/finance/payments', icon: 'pay', description: 'Record and track payments' },
          { label: 'Receivables', route: '/finance/receivables', icon: 'arrowup', description: 'Outstanding client payments' },
          { label: 'Payables', route: '/finance/payables', icon: 'arrowdown', description: 'Vendor and driver payables' },
          { label: 'Expenses', route: '/accountant/expenses', icon: 'wallet', description: 'Trip expense verification' },
          { label: 'Driver Payments', route: '/accountant/payments', icon: 'dollarsign', description: 'Pending trip & expense payments' },
          { label: 'Fuel Expenses', route: '/accountant/fuel', icon: 'fuel', description: 'Fuel cost analysis' },
          { label: 'Banking', route: '/accountant/banking', icon: 'bank', description: 'Bank entries and reconciliation' },
          { label: 'Ledger', route: '/finance/ledger', icon: 'book', description: 'General ledger and accounts' },
          { label: 'Reconciliation', route: '/finance/reconciliation', icon: 'bank', description: 'Bank statement reconciliation' },
          { label: 'Settlements', route: '/finance/settlements', icon: 'wallet', description: 'Driver settlement management' },
          { label: 'Finance Alerts', route: '/finance/alerts', icon: 'alert', description: 'Overdue & payment alerts' },
          { label: 'Finance Reports', route: '/finance/reports', icon: 'chart', description: 'Daily digest, P&L, GSTR-1' },
        ],
      },
      {
        label: 'Monitoring',
        items: [
          { label: 'Live Tracking', route: '/tracking', icon: 'pin', description: 'Real-time vehicle location map' },
          { label: 'Alerts', route: '/alerts', icon: 'alert', description: 'System alerts and notifications' },
          { label: 'Reports', route: '/reports', icon: 'chart', description: 'Analytics and business reports' },
        ],
      },
      {
        label: 'Fleet Manager',
        items: [
          { label: 'Fleet Dashboard', route: '/fleet', icon: 'gauge', description: 'Fleet overview and KPIs' },
          { label: 'Fleet Vehicles', route: '/fleet/vehicles', icon: 'truck', description: 'Vehicle health and maintenance' },
          { label: 'Fleet Drivers', route: '/fleet/drivers', icon: 'user', description: 'Driver performance and compliance' },
          { label: 'Fleet Tracking', route: '/fleet/tracking', icon: 'pin', description: 'Fleet GPS tracking map' },
          { label: 'Maintenance', route: '/fleet/maintenance', icon: 'wrench', description: 'Service records and schedules' },
          { label: 'Fuel Mgmt', route: '/fleet/fuel', icon: 'fuel', description: 'Fuel entries and efficiency tracking' },
          { label: 'Tyres', route: '/fleet/tyres', icon: 'circle', description: 'Tyre lifecycle and event tracking' },
          { label: 'Fleet Alerts', route: '/fleet/alerts', icon: 'bell', description: 'Compliance and service alerts' },
          { label: 'Geofences', route: '/fleet/geofences', icon: 'pin', description: 'Geofence zones and route corridors' },
          { label: 'Compliance', route: '/fleet/compliance', icon: 'shield', description: 'AIS-140 compliance and alerts' },
          { label: 'Driver Leaderboard', route: '/fleet/driver-leaderboard', icon: 'trophy', description: 'Driver behavior scores and rankings' },
          { label: 'TPMS', route: '/fleet/tpms', icon: 'activity', description: 'Tyre pressure monitoring system' },
          { label: 'Fleet Reports', route: '/fleet/reports', icon: 'chart', description: 'Fleet analytics and reports' },
        ],
      },
      {
        label: 'Compliance',
        items: [
          { label: 'Vehicle Compliance', route: '/fleet/vehicle-compliance', icon: 'shield', description: 'RC, Insurance, Fitness, Permit, PUC checks' },
          { label: 'Driver Compliance', route: '/fleet/driver-compliance', icon: 'id', description: 'DL verification and challan lookup' },
          { label: 'GST Verification', route: '/fleet/gst-verify', icon: 'receipt', description: 'Verify GSTIN and filing status' },
        ],
      },
      {
        label: 'Tools',
        items: [
          { label: 'GPS Live Map', route: '/tracking/gps', icon: 'pin', description: 'Live GPS positions of all vehicles' },
          { label: 'Trip Replay', route: '/tracking/replay', icon: 'play', description: 'Historical vehicle path replay' },
          { label: 'Fuel Prices', route: '/fleet/fuel-prices', icon: 'fuel', description: 'Current diesel/petrol prices by city' },
          { label: 'Route Calculator', route: '/trips/route-calculator', icon: 'route', description: 'Calculate distance between locations' },
          { label: 'Notifications', route: '/settings/notifications', icon: 'bell', description: 'Send SMS, WhatsApp, Push notifications' },
          { label: 'Document Upload', route: '/documents/new-upload', icon: 'upload', description: 'Upload files to S3 storage' },
        ],
      },
      {
        label: 'Quick Actions',
        items: [
          { label: 'Create LR', route: '/lr/new', icon: 'fileplus', description: 'Create a new lorry receipt' },
          { label: 'E-way Bill', route: '/lr/eway-bill', icon: 'receipt', description: 'Create and manage GST e-way bills' },
          { label: 'Create Trip', route: '/trips/new', icon: 'route', description: 'Create and assign trip execution' },
          { label: 'Upload Doc', route: '/documents/upload', icon: 'upload', description: 'Upload operational documents' },
          { label: 'Banking Entry', route: '/finance/banking/new', icon: 'bank', description: 'Create banking transaction entry' },
        ],
      },
      {
        label: 'System',
        items: [
          { label: 'Employees', route: '/admin/employees', icon: 'users', description: 'Manage staff accounts and roles' },
          { label: 'Branches', route: '/admin/branches', icon: 'building', description: 'Multi-branch management and P&L' },
          { label: 'Attendance', route: '/admin/attendance', icon: 'calendar', description: 'View all employee attendance' },
          { label: 'Connectivity', route: '/admin/connectivity', icon: 'wifi', description: 'System connectivity check' },
          { label: 'Settings', route: '/settings', icon: 'settings', description: 'System settings and preferences' },
        ],
      },
    ],
  },
  MANAGER: {
    sections: [
      {
        label: 'Overview',
        items: [
          { label: 'Dashboard', route: '/dashboard', icon: 'home', description: 'Company overview and quick KPIs' },
        ],
      },
      {
        label: 'Masters',
        items: [
          { label: 'Clients', route: '/clients', icon: 'users', description: 'Manage client records and contacts' },
          { label: 'Vehicles', route: '/vehicles', icon: 'truck', description: 'Fleet vehicle inventory and documents' },
          { label: 'Drivers', route: '/drivers', icon: 'id', description: 'Driver profiles, licences and compliance' },
          { label: 'Driver Dashboard', route: '/drivers/dashboard', icon: 'dashboard', description: 'Driver performance dashboard' },
          { label: 'Routes', route: '/routes', icon: 'route', description: 'Route master and distance definitions' },
          { label: 'Suppliers', route: '/suppliers', icon: 'truck', description: 'Manage supplier/contractor records' },
        ],
      },
      {
        label: 'Operations',
        items: [
          { label: 'Lorry Receipts', route: '/lr', icon: 'file', description: 'Generate and manage LR documents' },
          { label: 'Market Trips', route: '/market-trips', icon: 'truck', description: 'Hired truck trips and P&L' },
        ],
      },
      {
        label: 'Fleet Manager',
        items: [
          { label: 'Fleet Dashboard', route: '/fleet', icon: 'gauge', description: 'Fleet overview and KPIs' },
          { label: 'Fleet Vehicles', route: '/fleet/vehicles', icon: 'truck', description: 'Vehicle health and maintenance' },
          { label: 'Fleet Drivers', route: '/fleet/drivers', icon: 'user', description: 'Driver performance and compliance' },
          { label: 'Fleet Tracking', route: '/fleet/tracking', icon: 'pin', description: 'Fleet GPS tracking map' },
          { label: 'Maintenance', route: '/fleet/maintenance', icon: 'wrench', description: 'Service records and schedules' },
          { label: 'Fuel Mgmt', route: '/fleet/fuel', icon: 'fuel', description: 'Fuel entries and efficiency tracking' },
          { label: 'Tyres', route: '/fleet/tyres', icon: 'circle', description: 'Tyre lifecycle and event tracking' },
          { label: 'Fleet Alerts', route: '/fleet/alerts', icon: 'bell', description: 'Compliance and service alerts' },
          { label: 'Geofences', route: '/fleet/geofences', icon: 'pin', description: 'Geofence zones and route corridors' },
          { label: 'Compliance', route: '/fleet/compliance', icon: 'shield', description: 'AIS-140 compliance and alerts' },
          { label: 'Driver Leaderboard', route: '/fleet/driver-leaderboard', icon: 'trophy', description: 'Driver behavior scores and rankings' },
          { label: 'TPMS', route: '/fleet/tpms', icon: 'activity', description: 'Tyre pressure monitoring system' },
          { label: 'Fleet Reports', route: '/fleet/reports', icon: 'chart', description: 'Fleet analytics and reports' },
        ],
      },
      {
        label: 'Accountant',
        items: [
          { label: 'Finance Dashboard', route: '/accountant', icon: 'gauge', description: 'Financial overview and KPIs' },
          { label: 'Invoices', route: '/accountant/invoices', icon: 'invoice', description: 'Invoice management and GST' },
          { label: 'Receivables', route: '/accountant/receivables', icon: 'arrowup', description: 'Client outstanding amounts' },
          { label: 'Payables', route: '/accountant/payables', icon: 'arrowdown', description: 'Vendor payment tracking' },
          { label: 'Expenses', route: '/accountant/expenses', icon: 'wallet', description: 'Trip expense verification' },
          { label: 'Driver Payments', route: '/accountant/payments', icon: 'dollarsign', description: 'Pending trip & expense payments' },
          { label: 'Fuel Expenses', route: '/accountant/fuel', icon: 'fuel', description: 'Fuel cost analysis' },
          { label: 'Banking', route: '/accountant/banking', icon: 'bank', description: 'Bank entries and reconciliation' },
          { label: 'Reconciliation', route: '/finance/reconciliation', icon: 'bank', description: 'Bank statement auto-reconciliation' },
          { label: 'Settlements', route: '/finance/settlements', icon: 'wallet', description: 'Driver settlement management' },
          { label: 'Ledger', route: '/accountant/ledger', icon: 'book', description: 'Double-entry bookkeeping' },
          { label: 'Finance Alerts', route: '/finance/alerts', icon: 'alert', description: 'Overdue invoices & payment alerts' },
          { label: 'Finance Reports', route: '/finance/reports', icon: 'chart', description: 'Daily digest, P&L, GSTR-1' },
        ],
      },
      {
        label: 'Compliance',
        items: [
          { label: 'Vehicle Compliance', route: '/fleet/vehicle-compliance', icon: 'shield', description: 'RC, Insurance, Fitness, Permit, PUC checks' },
          { label: 'Driver Compliance', route: '/fleet/driver-compliance', icon: 'id', description: 'DL verification and challan lookup' },
        ],
      },
      {
        label: 'Tools',
        items: [
          { label: 'GPS Live Map', route: '/tracking/gps', icon: 'pin', description: 'Live GPS positions of all vehicles' },
          { label: 'Trip Replay', route: '/tracking/replay', icon: 'play', description: 'Historical vehicle path replay' },
          { label: 'Fuel Prices', route: '/fleet/fuel-prices', icon: 'fuel', description: 'Current diesel/petrol prices by city' },
          { label: 'Route Calculator', route: '/trips/route-calculator', icon: 'route', description: 'Calculate distance between locations' },
          { label: 'Notifications', route: '/settings/notifications', icon: 'bell', description: 'Send SMS, WhatsApp, Push notifications' },
        ],
      },
      {
        label: 'Quick Actions',
        items: [
          { label: 'Create LR', route: '/lr/new', icon: 'fileplus', description: 'Create a new lorry receipt' },
          { label: 'E-way Bill', route: '/lr/eway-bill', icon: 'receipt', description: 'Create and manage GST e-way bills' },
          { label: 'Create Trip', route: '/trips/new', icon: 'route', description: 'Create and assign trip execution' },
          { label: 'Upload Doc', route: '/documents/upload', icon: 'upload', description: 'Upload operational documents' },
          { label: 'Banking Entry', route: '/finance/banking/new', icon: 'bank', description: 'Create banking transaction entry' },
        ],
      },
      {
        label: 'System',
        items: [
          { label: 'Attendance', route: '/my-work/attendance', icon: 'clock', description: 'Mark daily attendance with camera check-in' },
          { label: 'Settings', route: '/settings', icon: 'settings', description: 'System settings and preferences' },
        ],
      },
    ],
  },
  FLEET_MANAGER: {
    sections: [
      { label: 'Overview', items: [{ label: 'Dashboard', route: '/fleet/dashboard', icon: 'home', description: 'Fleet KPIs and operational overview' }] },
      {
        label: 'Operations',
        items: [
          { label: 'Lorry Receipts', route: '/lr', icon: 'file', description: 'Generate and manage LR documents' },
        ],
      },
      {
        label: 'Finance',
        items: [
          { label: 'Invoices', route: '/finance/invoices', icon: 'invoice', description: 'View invoices for trip reference' },
        ],
      },
      {
        label: 'Fleet Manager',
        items: [
          { label: 'Fleet Dashboard', route: '/fleet', icon: 'gauge', description: 'Fleet overview and KPIs' },
          { label: 'Fleet Vehicles', route: '/fleet/vehicles', icon: 'truck', description: 'Vehicle health and maintenance' },
          { label: 'Fleet Drivers', route: '/fleet/drivers', icon: 'user', description: 'Driver performance and compliance' },
          { label: 'Fleet Tracking', route: '/fleet/tracking', icon: 'pin', description: 'Fleet GPS tracking map' },
          { label: 'Maintenance', route: '/fleet/maintenance', icon: 'wrench', description: 'Service records and schedules' },
          { label: 'Fuel Mgmt', route: '/fleet/fuel', icon: 'fuel', description: 'Fuel entries and efficiency tracking' },
          { label: 'Tyres', route: '/fleet/tyres', icon: 'circle', description: 'Tyre lifecycle and event tracking' },
          { label: 'Fleet Alerts', route: '/fleet/alerts', icon: 'bell', description: 'Compliance and service alerts' },
          { label: 'Geofences', route: '/fleet/geofences', icon: 'pin', description: 'Geofence zones and route corridors' },
          { label: 'AIS-140 Compliance', route: '/fleet/compliance', icon: 'shield', description: 'AIS-140 compliance and alerts' },
          { label: 'Driver Leaderboard', route: '/fleet/driver-leaderboard', icon: 'trophy', description: 'Driver behavior scores and rankings' },
          { label: 'TPMS', route: '/fleet/tpms', icon: 'activity', description: 'Tyre pressure monitoring system' },
          { label: 'Fleet Reports', route: '/fleet/reports', icon: 'chart', description: 'Fleet analytics and reports' },
        ],
      },
      {
        label: 'Compliance',
        items: [
          { label: 'Vehicle Compliance', route: '/fleet/vehicle-compliance', icon: 'shield', description: 'RC, Insurance, Fitness, Permit, PUC checks' },
          { label: 'Driver Compliance', route: '/fleet/driver-compliance', icon: 'id', description: 'DL verification and challan lookup' },
        ],
      },
      {
        label: 'Tools',
        items: [
          { label: 'GPS Live Map', route: '/tracking/gps', icon: 'pin', description: 'Live GPS positions of all vehicles' },
          { label: 'Fuel Prices', route: '/fleet/fuel-prices', icon: 'fuel', description: 'Current diesel/petrol prices by city' },
        ],
      },
      {
        label: 'System',
        items: [
          { label: 'Attendance', route: '/my-work/attendance', icon: 'clock', description: 'Mark daily attendance with camera check-in' },
          { label: 'Settings', route: '/settings', icon: 'settings', description: 'System settings and preferences' },
        ],
      },
    ],
  },
  ACCOUNTANT: {
    sections: [
      { label: 'Overview', items: [{ label: 'Dashboard', route: '/dashboard', icon: 'home', description: 'Company overview and quick KPIs' }] },
      {
        label: 'Finance',
        items: [
          { label: 'Finance Dashboard', route: '/accountant', icon: 'gauge', description: 'Financial overview and KPIs' },
          { label: 'Invoices', route: '/accountant/invoices', icon: 'invoice', description: 'Invoice management and GST' },
          { label: 'Receivables', route: '/accountant/receivables', icon: 'arrowup', description: 'Client outstanding amounts' },
          { label: 'Payables', route: '/accountant/payables', icon: 'arrowdown', description: 'Vendor payment tracking' },
          { label: 'Expenses', route: '/accountant/expenses', icon: 'wallet', description: 'Trip expense verification' },
          { label: 'Fuel Expenses', route: '/accountant/fuel', icon: 'fuel', description: 'Fuel cost analysis' },
          { label: 'Banking', route: '/accountant/banking', icon: 'bank', description: 'Bank entries and reconciliation' },
          { label: 'Ledger', route: '/accountant/ledger', icon: 'book', description: 'Double-entry bookkeeping' },
          { label: 'Reconciliation', route: '/finance/reconciliation', icon: 'bank', description: 'Bank statement auto-reconciliation' },
          { label: 'Settlements', route: '/finance/settlements', icon: 'wallet', description: 'Driver settlement management' },
          { label: 'Finance Alerts', route: '/finance/alerts', icon: 'alert', description: 'Overdue invoices & payment alerts' },
          { label: 'Finance Reports', route: '/finance/reports', icon: 'chart', description: 'Daily digest, P&L, GSTR-1' },
        ],
      },
      {
        label: 'Compliance',
        items: [
          { label: 'GST Verification', route: '/fleet/gst-verify', icon: 'receipt', description: 'Verify GSTIN and filing status' },
        ],
      },
      {
        label: 'System',
        items: [
          { label: 'Banking Entry', route: '/finance/banking/new', icon: 'bank', description: 'Create banking transaction entry' },
          { label: 'Attendance', route: '/my-work/attendance', icon: 'clock', description: 'Mark daily attendance with camera check-in' },
          { label: 'Settings', route: '/settings', icon: 'settings', description: 'System settings and preferences' },
        ],
      },
    ],
  },
  PROJECT_ASSOCIATES: {
    sections: [
      { label: 'Overview', items: [{ label: 'Dashboard', route: '/dashboard', icon: 'home', description: 'Company overview and quick KPIs' }] },
      {
        label: 'Operations',
        items: [
          { label: 'Lorry Receipts', route: '/lr', icon: 'file', description: 'Generate and manage LR documents' },
        ],
      },
      {
        label: 'Finance',
        items: [
          { label: 'Invoices', route: '/finance/invoices', icon: 'invoice', description: 'Generate invoices after trip completion' },
        ],
      },
      {
        label: 'Quick Actions',
        items: [
          { label: 'Create LR', route: '/lr/new', icon: 'fileplus', description: 'Create a new lorry receipt' },
          { label: 'E-way Bill', route: '/lr/eway-bill', icon: 'receipt', description: 'Create and manage GST e-way bills' },
          { label: 'Create Trip', route: '/trips/new', icon: 'route', description: 'Create and assign trip execution' },
          { label: 'Upload Doc', route: '/documents/upload', icon: 'upload', description: 'Upload operational documents' },
          { label: 'Banking Entry', route: '/finance/banking/new', icon: 'bank', description: 'Create banking transaction entry' },
        ],
      },
      {
        label: 'System',
        items: [
          { label: 'Attendance', route: '/my-work/attendance', icon: 'clock', description: 'Mark daily attendance with camera check-in' },
          { label: 'Settings', route: '/settings', icon: 'settings', description: 'System settings and preferences' },
        ],
      },
    ],
  },
  DRIVER: {
    sections: [
      { label: 'Overview', items: [{ label: 'Dashboard', route: '/dashboard', icon: 'home', description: 'Company overview and quick KPIs' }] },
      {
        label: 'My Work',
        items: [
          { label: 'My Trips', route: '/driver/trips', icon: 'map', description: 'Assigned trips and progress tracking' },
          { label: 'Attendance', route: '/driver/attendance', icon: 'clock', description: 'Daily check-in and attendance logs' },
          { label: 'Expenses', route: '/driver/expenses', icon: 'wallet', description: 'Submit and view trip expenses' },
          { label: 'My Documents', route: '/driver/documents', icon: 'folder', description: 'Personal and trip-related documents' },
        ],
      },
    ],
  },
  PUMP_OPERATOR: {
    sections: [
      { label: 'Overview', items: [{ label: 'Fuel Dashboard', route: '/pump/dashboard', icon: 'gauge', description: 'Fuel stock levels and daily activity' }] },
      {
        label: 'Fuel Operations',
        items: [
          { label: 'Issue Fuel', route: '/pump/issue', icon: 'fuel', description: 'Dispense fuel to vehicles' },
          { label: 'Fuel Log', route: '/pump/log', icon: 'list', description: 'All fuel issue records' },
          { label: 'Tank Stock', route: '/pump/stock', icon: 'database', description: 'Tank levels and refill history' },
        ],
      },
      {
        label: 'Monitoring',
        items: [
          { label: 'Theft Alerts', route: '/pump/alerts', icon: 'alert', description: 'Anomaly detection alerts' },
          { label: 'Reports', route: '/pump/reports', icon: 'chart', description: 'Fuel consumption reports' },
          { label: 'Fuel Audit', route: '/pump/fuel-verification', icon: 'shield', description: 'Cross-verify pump vs driver records' },
        ],
      },
    ],
  },
};

export const enterpriseNavConfig: NavMenuGroup[] = [
  {
    label: 'Overview',
    path: '/dashboard',
  },
  {
    label: 'Masters',
    roles: ['admin', 'manager'],
    items: [
      { label: 'Clients', path: '/clients', permission: 'clients:read' },
      { label: 'Vehicles', path: '/vehicles', permission: 'vehicles:read' },
      { label: 'Drivers', path: '/drivers', permission: 'drivers:read' },
      { label: 'Driver Dashboard', path: '/drivers/dashboard', permission: 'drivers:read' },
      { label: 'Routes', path: '/routes', permission: 'clients:view', roles: ['admin', 'manager'] },
    ],
  },
  {
    label: 'Operations',
    roles: ['admin', 'manager', 'fleet_manager', 'project_associate'],
    items: [
      { label: 'Jobs / Orders', path: '/jobs', permission: 'jobs:read' },
      { label: 'Lorry Receipts', path: '/lr', permission: 'lr:read' },
      { label: 'Trips', path: '/trips', permission: 'trips:read' },
      { label: 'Documents', path: '/documents', permission: 'documents:read' },
      { label: 'E-way Bill', path: '/lr/eway-bill', permission: 'eway:read' },
    ],
  },
  {
    label: 'Finance',
    roles: ['admin'],
    items: [
      { label: 'Invoices', path: '/finance/invoices', permission: 'invoices:read', roles: ['admin', 'manager', 'fleet_manager', 'project_associate', 'accountant'] },
      { label: 'Payments', path: '/finance/payments', permission: 'payments:read' },
      { label: 'Ledger', path: '/finance/ledger', permission: 'ledger:read' },
      { label: 'Receivables', path: '/finance/receivables', permission: 'receivables:read', roles: ['admin', 'manager', 'accountant'] },
      { label: 'Payables', path: '/finance/payables', permission: 'payables:read', roles: ['admin', 'manager', 'accountant'] },
      { label: 'Banking Entry', path: '/finance/banking/new', roles: ['admin', 'manager', 'accountant'] },
    ],
  },
  {
    label: 'Monitoring',
    roles: ['admin', 'manager', 'project_associate'],
    items: [
      { label: 'Live Tracking', path: '/tracking', permission: 'tracking:read' },
      { label: 'Alerts', path: '/alerts', permission: 'alerts:read' },
    ],
  },
  {
    label: 'Reports',
    roles: ['admin', 'manager', 'fleet_manager', 'accountant'],
    items: [
      { label: 'Reports', path: '/reports', permission: 'reports:read', roles: ['admin', 'manager', 'fleet_manager'] },
      { label: 'Fleet Reports', path: '/fleet/reports', roles: ['admin', 'fleet_manager'] },
      { label: 'Accountant Reports', path: '/accountant/reports', roles: ['admin', 'accountant'] },
    ],
  },
  {
    label: 'Fleet Manager',
    items: [
      { label: 'Fleet Dashboard', path: '/fleet', roles: ['admin', 'fleet_manager'] },
      { label: 'Fleet Vehicles', path: '/fleet/vehicles', roles: ['admin', 'fleet_manager'] },
      { label: 'Fleet Drivers', path: '/fleet/drivers', roles: ['admin', 'fleet_manager'] },
      { label: 'Live Tracking', path: '/fleet/tracking', roles: ['admin', 'fleet_manager'] },
      { label: 'Maintenance', path: '/fleet/maintenance', roles: ['admin', 'fleet_manager'] },
      { label: 'Fuel Mgmt', path: '/fleet/fuel', roles: ['admin', 'fleet_manager'] },
      { label: 'Tyres', path: '/fleet/tyres', roles: ['admin', 'fleet_manager'] },
      { label: 'Fleet Alerts', path: '/fleet/alerts', roles: ['admin', 'fleet_manager'] },
      { label: 'Geofences', path: '/fleet/geofences', roles: ['admin', 'fleet_manager'] },
      { label: 'Compliance', path: '/fleet/compliance', roles: ['admin', 'fleet_manager'] },
      { label: 'Driver Leaderboard', path: '/fleet/driver-leaderboard', roles: ['admin', 'manager', 'fleet_manager'] },
      { label: 'TPMS', path: '/fleet/tpms', roles: ['admin', 'fleet_manager'] },
      { label: 'Fleet Reports', path: '/fleet/reports', roles: ['admin', 'fleet_manager'] },
    ],
    roles: ['admin', 'fleet_manager'],
  },
  {
    label: 'Accountant',
    items: [
      { label: 'Finance Dashboard', path: '/accountant', roles: ['admin', 'accountant'] },
      { label: 'Invoices', path: '/accountant/invoices', roles: ['admin', 'accountant'] },
      { label: 'Receivables', path: '/accountant/receivables', roles: ['admin', 'accountant'] },
      { label: 'Payables', path: '/accountant/payables', roles: ['admin', 'accountant'] },
      { label: 'Expenses', path: '/accountant/expenses', roles: ['admin', 'accountant'] },
      { label: 'Fuel Expenses', path: '/accountant/fuel', roles: ['admin', 'accountant'] },
      { label: 'Banking', path: '/accountant/banking', roles: ['admin', 'accountant'] },
      { label: 'Ledger', path: '/accountant/ledger', roles: ['admin', 'accountant'] },
      { label: 'Reports', path: '/accountant/reports', roles: ['admin', 'accountant'] },
    ],
    roles: ['admin', 'accountant'],
  },
  {
    label: 'Compliance',
    roles: ['admin', 'manager', 'fleet_manager', 'accountant'],
    items: [
      { label: 'Vehicle Compliance', path: '/fleet/vehicle-compliance', roles: ['admin', 'manager', 'fleet_manager'] },
      { label: 'Driver Compliance', path: '/fleet/driver-compliance', roles: ['admin', 'manager', 'fleet_manager'] },
      { label: 'GST Verification', path: '/fleet/gst-verify', roles: ['admin', 'manager', 'accountant'] },
    ],
  },
  {
    label: 'Tools',
    roles: ['admin', 'manager', 'fleet_manager', 'accountant'],
    items: [
      { label: 'GPS Live Map', path: '/tracking/gps', roles: ['admin', 'manager', 'fleet_manager'] },
      { label: 'Trip Replay', path: '/tracking/replay', roles: ['admin', 'manager'] },
      { label: 'Fuel Prices', path: '/fleet/fuel-prices', roles: ['admin', 'manager', 'fleet_manager'] },
      { label: 'Route Calculator', path: '/trips/route-calculator', roles: ['admin', 'manager'] },
      { label: 'Notifications', path: '/settings/notifications', roles: ['admin', 'manager'] },
      { label: 'Document Upload', path: '/documents/new-upload', roles: ['admin', 'manager'] },
    ],
  },
  {
    label: 'Admin',
    roles: ['admin'],
    items: [
      { label: 'Employees', path: '/admin/employees', roles: ['admin'] },
      { label: 'Attendance', path: '/admin/attendance', roles: ['admin'] },
      { label: 'Connectivity', path: '/admin/connectivity', roles: ['admin'] },
      { label: 'Settings', path: '/settings', roles: ['admin'] },
    ],
  },
  {
    label: 'My Work',
    roles: ['driver', 'manager', 'fleet_manager', 'accountant', 'project_associate'],
    items: [
      { label: 'My Trips', path: '/driver/trips', roles: ['driver'] },
      { label: 'Attendance', path: '/my-work/attendance', roles: ['driver', 'manager', 'fleet_manager', 'accountant', 'project_associate'] },
      { label: 'Expenses', path: '/driver/expenses', roles: ['driver'] },
      { label: 'My Documents', path: '/driver/documents', roles: ['driver'] },
    ],
  },
];
