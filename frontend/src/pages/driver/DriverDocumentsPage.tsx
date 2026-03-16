import { Link } from 'react-router-dom';

export default function DriverDocumentsPage() {
  return (
    <div className="max-w-4xl mx-auto py-10">
      <h1 className="text-2xl font-bold text-gray-900">My Documents</h1>
      <p className="mt-3 text-gray-600">Coming soon.</p>
      <Link
        to="/dashboard"
        className="inline-block mt-6 text-sm font-medium text-primary-600 hover:text-primary-700"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
