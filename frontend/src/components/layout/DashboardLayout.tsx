import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { EnterpriseNav } from './nav';
import { useAppStore } from '@/store/appStore';
import { wsService } from '@/services/websocketService';

export default function DashboardLayout() {
  const { sidebarCollapsed } = useAppStore();

  useEffect(() => {
    wsService.connect();
    return () => wsService.disconnect();
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className={`flex flex-1 flex-col min-w-0 transition-all duration-300 ease-in-out ${
        sidebarCollapsed ? 'ml-[72px]' : 'ml-[260px]'
      }`}>
        <Header />
        <EnterpriseNav />
        <main className="flex-1 overflow-y-auto overflow-x-auto px-6 py-5">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
