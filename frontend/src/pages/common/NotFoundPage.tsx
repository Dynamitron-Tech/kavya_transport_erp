import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="card max-w-lg w-full text-center">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
          <AlertTriangle size={24} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">404</h1>
        <p className="text-lg font-semibold text-gray-800 mb-2">Page not found</p>
        <p className="text-sm text-gray-500 mb-6">The page you are looking for does not exist or has been moved.</p>
        <Link to="/dashboard" className="btn-primary inline-flex items-center gap-2">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
