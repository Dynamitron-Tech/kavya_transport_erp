import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { NAV_CONFIG, type HeaderNavRole } from './nav/navConfig';
import {
  LayoutDashboard, Building2, Truck, UserCheck, ClipboardList,
  FileText, Navigation, Receipt, DollarSign, BookOpen, TrendingUp,
  TrendingDown, MapPinned, BarChart3, Settings, ChevronLeft,
  ChevronRight, LogOut, PlusCircle, FilePlus, Route, Upload,
  Bell, Fuel, Wrench, Gauge, Wallet, Landmark, Clock,
  Folder, List, Database, AlertTriangle, Shield, Trophy, Circle,
  Activity, Calendar, Wifi,
} from 'lucide-react';

const resolveRole = (rawRole?: string): HeaderNavRole => {
  const normalized = (rawRole || '').toUpperCase();
  if (normalized === 'MANAGER') return 'MANAGER';
  if (normalized === 'FLEET_MANAGER') return 'FLEET_MANAGER';
  if (normalized === 'ACCOUNTANT') return 'ACCOUNTANT';
  if (normalized === 'PROJECT_ASSOCIATE' || normalized === 'PROJECT_ASSOCIATES') return 'PROJECT_ASSOCIATES';
  if (normalized === 'DRIVER') return 'DRIVER';
  if (normalized === 'PUMP_OPERATOR') return 'PUMP_OPERATOR';
  return 'ADMIN';
};

const iconMap: Record<string, React.ReactNode> = {
  home: <LayoutDashboard size={20} />,
  users: <Building2 size={20} />,
  truck: <Truck size={20} />,
  id: <UserCheck size={20} />,
  dashboard: <LayoutDashboard size={20} />,
  briefcase: <ClipboardList size={20} />,
  file: <FileText size={20} />,
  map: <Navigation size={20} />,
  folder: <Folder size={20} />,
  invoice: <Receipt size={20} />,
  pay: <DollarSign size={20} />,
  book: <BookOpen size={20} />,
  arrowup: <TrendingUp size={20} />,
  arrowdown: <TrendingDown size={20} />,
  pin: <MapPinned size={20} />,
  alert: <Bell size={20} />,
  chart: <BarChart3 size={20} />,
  gauge: <Gauge size={20} />,
  user: <UserCheck size={20} />,
  wrench: <Wrench size={20} />,
  fuel: <Fuel size={20} />,
  bell: <Bell size={20} />,
  wallet: <Wallet size={20} />,
  bank: <Landmark size={20} />,
  plus: <PlusCircle size={20} />,
  fileplus: <FilePlus size={20} />,
  receipt: <Receipt size={20} />,
  route: <Route size={20} />,
  upload: <Upload size={20} />,
  settings: <Settings size={20} />,
  clock: <Clock size={20} />,
  list: <List size={20} />,
  database: <Database size={20} />,
  warning: <AlertTriangle size={20} />,
  dollarsign: <DollarSign size={20} />,
  shield: <Shield size={20} />,
  trophy: <Trophy size={20} />,
  circle: <Circle size={20} />,
  activity: <Activity size={20} />,
  building: <Building2 size={20} />,
  calendar: <Calendar size={20} />,
  wifi: <Wifi size={20} />,
};

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebarCollapse } = useAppStore();
  const location = useLocation();
  const userRole = resolveRole((user as any)?.role || user?.roles?.[0]);
  const sections = [
    ...(NAV_CONFIG[userRole]?.sections ?? []),
    {
      label: 'ACCOUNT',
      items: [{ label: 'Profile', route: '/profile', icon: 'user' }],
    },
  ];

  // Collect all routes so we can find the best (longest) match
  const allRoutes = sections.flatMap((s) => s.items.map((i) => i.route));

  const getBestMatchRoute = (pathname: string): string | null => {
    let best: string | null = null;
    for (const route of allRoutes) {
      if (pathname === route || (route !== '/dashboard' && pathname.startsWith(route + '/'))) {
        if (!best || route.length > best.length) best = route;
      }
    }
    return best;
  };

  const bestMatch = getBestMatchRoute(location.pathname);

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out ${
        sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'
      }`}
    >
      {/* Logo / Brand */}
      <div className="flex items-center h-16 px-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-600/20">
            <Truck size={20} className="text-white" />
          </div>
          {!sidebarCollapsed && (
            <div className="animate-fade-in min-w-0">
              <h1 className="text-gray-900 font-bold text-[15px] leading-tight tracking-tight">TransportERP</h1>
              <p className="text-gray-500 text-[10px] font-medium uppercase tracking-widest">Fleet Management</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto sidebar-scroll py-3 px-3 space-y-5">
        {sections.map((section) => (
          <div key={section.label}>
            {!sidebarCollapsed && (
              <h3 className="px-3 mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-[0.1em]">
                {section.label}
              </h3>
            )}
            {sidebarCollapsed && <div className="border-t border-gray-200 mb-2" />}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = bestMatch === item.route;

                return (
                  <li key={item.route}>
                    <NavLink
                      to={item.route}
                      className={`sidebar-nav-btn flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium border border-transparent transition-all duration-200 group relative
                        ${isActive
                          ? 'sidebar-nav-btn-active text-white'
                          : 'sidebar-nav-btn-idle text-gray-600'
                        }
                        ${sidebarCollapsed ? 'justify-center px-0 mx-1' : ''}
                      `}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <span className={`flex-shrink-0 transition-colors duration-150 ${
                        isActive ? 'text-white' : 'text-gray-500 group-hover:text-blue-900'
                      }`}>
                        {iconMap[item.icon] || <FileText size={20} />}
                      </span>
                      {!sidebarCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                      {/* Tooltip for collapsed */}
                      {sidebarCollapsed && (
                        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg
                          opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50 shadow-dropdown">
                          {item.label}
                          <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45" />
                        </div>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-gray-200 p-3 flex-shrink-0">
        {!sidebarCollapsed ? (
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 ring-2 ring-gray-200">
              <span className="text-white text-sm font-bold">
                {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 text-sm font-medium truncate">{user?.full_name}</p>
              <p className="text-gray-500 text-[11px] truncate capitalize">
                {user?.roles[0]?.replace('_', ' ') || 'User'}
              </p>
            </div>
            <button
              onClick={() => logout()}
              className="p-1.5 text-gray-500 hover:text-red-500 rounded-lg hover:bg-gray-100 transition-colors"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => logout()}
            className="w-full flex items-center justify-center p-2.5 text-gray-500 hover:text-red-500 rounded-lg hover:bg-gray-100 transition-colors"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebarCollapse}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-gray-200 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 hover:scale-110 transition-all z-50"
      >
        {sidebarCollapsed ? (
          <ChevronRight size={12} className="text-gray-600" />
        ) : (
          <ChevronLeft size={12} className="text-gray-600" />
        )}
      </button>
    </aside>
  );
}
