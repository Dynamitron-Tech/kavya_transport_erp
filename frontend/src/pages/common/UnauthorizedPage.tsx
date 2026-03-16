import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

export const UnauthorizedPage = () => (
  <div className="flex flex-col items-center justify-center min-h-96 text-center p-8">
    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
      <Shield className="w-8 h-8 text-red-500" />
    </div>
    <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
    <p className="text-gray-500 mb-6 max-w-sm">
      You don't have permission to view this page.
      Contact your administrator if you need access.
    </p>
    <Link
      to="/dashboard"
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
    >
      Go to Dashboard
    </Link>
  </div>
);
