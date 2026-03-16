export const getRoleHomePage = (role?: string): string => {
  switch ((role || '').toUpperCase()) {
    case 'ADMIN':
      return '/dashboard';
    case 'MANAGER':
      return '/dashboard';
    case 'FLEET_MANAGER':
      return '/fleet/dashboard';
    case 'ACCOUNTANT':
      return '/accountant/dashboard';
    case 'PROJECT_ASSOCIATE':
    case 'PROJECT_ASSOCIATES':
      return '/dashboard';
    case 'DRIVER':
      return '/driver/trips';
    default:
      return '/dashboard';
  }
};
