import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { UnauthorizedPage } from '@/pages/common/UnauthorizedPage';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredRole?: string;
}

export default function AuthGuard({ children, requiredPermission, requiredRole }: AuthGuardProps) {
  const { isAuthenticated, isLoading, hasPermission, hasRole } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <UnauthorizedPage />;
  }

  if (requiredRole && !hasRole(requiredRole as any)) {
    return <UnauthorizedPage />;
  }

  return <>{children}</>;
}
