import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import ErrorBoundary from '@/components/common/ErrorBoundary';

// Layout
import DashboardLayout from '@/components/layout/DashboardLayout';
import AuthGuard from '@/components/auth/AuthGuard';

// Auth pages
import LoginPage from '@/pages/auth/LoginPage';

// Dashboard
import DashboardPage from '@/pages/dashboard/DashboardPage';

// Master pages
import ClientsPage from '@/pages/clients/ClientsPage';
import ClientDetailPage from '@/pages/clients/ClientDetailPage';
import VehiclesPage from '@/pages/vehicles/VehiclesPage';
import VehicleDetailPage from '@/pages/vehicles/VehicleDetailPage';
import DriversPage from '@/pages/drivers/DriversPage';
import DriverDetailPage from '@/pages/drivers/DriverDetailPage';
import DriverDashboardPage from '@/pages/drivers/DriverDashboardPage';
import DriverTripsPage from '@/pages/driver/DriverTripsPage';
import DriverAttendancePage from '@/pages/driver/DriverAttendancePage';
import DriverExpensesPage from '@/pages/driver/DriverExpensesPage';
import DriverDocumentsPage from '@/pages/driver/DriverDocumentsPage';

// Operations
import JobsPage from '@/pages/jobs/JobsPage';
import JobDetailPage from '@/pages/jobs/JobDetailPage';
import CreateJobPage from '@/pages/jobs/CreateJobPage';
import LRListPage from '@/pages/lr/LRListPage';
import LRDetailPage from '@/pages/lr/LRDetailPage';
import CreateLRPage from '@/pages/lr/CreateLRPage';
import EwayBillListPage from '@/pages/eway-bill/EwayBillListPage';
import EwayBillDetailPage from '@/pages/eway-bill/EwayBillDetailPage';
import GenerateEwayBillPage from '@/pages/eway-bill/GenerateEwayBillPage';
import TripsPage from '@/pages/trips/TripsPage';
import TripDetailPage from '@/pages/trips/TripDetailPage';
import CreateTripPage from '@/pages/trips/CreateTripPage';

// Documents
import DocumentListPage from '@/pages/documents/DocumentListPage';
import UploadDocumentPage from '@/pages/documents/UploadDocumentPage';

// Finance
import InvoicesPage from '@/pages/finance/InvoicesPage';
import PaymentsPage from '@/pages/finance/PaymentsPage';
import LedgerPage from '@/pages/finance/LedgerPage';
import ReceivablesPage from '@/pages/finance/ReceivablesPage';
import PayablesPage from '@/pages/finance/PayablesPage';
import BankingEntryPage from '@/pages/finance/BankingEntryPage';

// Tracking
import LiveTrackingPage from '@/pages/tracking/LiveTrackingPage';
import GPSLiveMapPage from '@/pages/tracking/GPSLiveMapPage';
import TripReplayPage from '@/pages/tracking/TripReplayPage';

// Reports
import ReportsPage from '@/pages/reports/ReportsPage';

// Compliance & Tools
import VehicleCompliancePage from '@/pages/fleet/VehicleCompliancePage';
import DriverCompliancePage from '@/pages/fleet/DriverCompliancePage';
import GSTVerificationPage from '@/pages/fleet/GSTVerificationPage';
import FuelPricePage from '@/pages/fleet/FuelPricePage';
import RouteCalculatorPage from '@/pages/trips/RouteCalculatorPage';
import PaymentLinkPage from '@/pages/finance/PaymentLinkPage';
import NotificationCenterPage from '@/pages/settings/NotificationCenterPage';
import DocumentUploadPage from '@/pages/documents/DocumentUploadPage';

// Settings
import SettingsPage from '@/pages/settings/SettingsPage';

// Fleet Manager
import FleetDashboardPage from '@/pages/fleet/FleetDashboardPage';
import FleetVehiclesPage from '@/pages/fleet/FleetVehiclesPage';
import FleetDriversPage from '@/pages/fleet/FleetDriversPage';
import FleetTrackingPage from '@/pages/fleet/FleetTrackingPage';
import FleetMaintenancePage from '@/pages/fleet/FleetMaintenancePage';
import FleetFuelPage from '@/pages/fleet/FleetFuelPage';
import FleetAlertsPage from '@/pages/fleet/FleetAlertsPage';
import FleetReportsPage from '@/pages/fleet/FleetReportsPage';
import FuelPage from '@/pages/fleet/FuelPage';
import TyrePage from '@/pages/fleet/TyrePage';
import ServicePage from '@/pages/fleet/ServicePage';
import RoutesPage from '@/pages/masters/RoutesPage';

// Accountant
import AccountantDashboardPage from '@/pages/accountant/AccountantDashboardPage';
import AccountantInvoicesPage from '@/pages/accountant/AccountantInvoicesPage';
import AccountantReceivablesPage from '@/pages/accountant/AccountantReceivablesPage';
import AccountantPayablesPage from '@/pages/accountant/AccountantPayablesPage';
import AccountantExpensesPage from '@/pages/accountant/AccountantExpensesPage';
import AccountantFuelExpensePage from '@/pages/accountant/AccountantFuelExpensePage';
import AccountantBankingPage from '@/pages/accountant/AccountantBankingPage';
import AccountantLedgerPage from '@/pages/accountant/AccountantLedgerPage';
import AccountantReportsPage from '@/pages/accountant/AccountantReportsPage';
import ConnectivityPage from '@/pages/admin/ConnectivityPage';
import NotFoundPage from '@/pages/common/NotFoundPage';
import { getRoleHomePage } from '@/utils/roleRouting';

function App() {
  const { fetchUser, isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return (
    <ErrorBoundary>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={
          isAuthenticated ? <Navigate to={getRoleHomePage(user?.roles?.[0])} replace /> : <LoginPage />
        } />

        {/* Protected routes */}
        <Route element={<AuthGuard><DashboardLayout /></AuthGuard>}>
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Clients */}
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/:id" element={<ClientDetailPage />} />

          {/* Vehicles */}
          <Route path="/vehicles" element={<VehiclesPage />} />
          <Route path="/vehicles/:id" element={<VehicleDetailPage />} />

          {/* Drivers */}
          <Route path="/drivers" element={<DriversPage />} />
          <Route path="/drivers/dashboard" element={<DriverDashboardPage />} />
          <Route path="/drivers/:id" element={<DriverDetailPage />} />

          {/* Driver Work */}
          <Route path="/driver/trips" element={<DriverTripsPage />} />
          <Route path="/driver/attendance" element={<DriverAttendancePage />} />
          <Route path="/driver/expenses" element={<DriverExpensesPage />} />
          <Route path="/driver/documents" element={<DriverDocumentsPage />} />

          {/* Jobs */}
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/new" element={<CreateJobPage />} />
          <Route path="/jobs/:id/edit" element={<CreateJobPage />} />
          <Route path="/jobs/:id" element={<JobDetailPage />} />

          {/* LR */}
          <Route path="/lr" element={<LRListPage />} />
          <Route path="/lr/new" element={<CreateLRPage />} />
          <Route path="/lr/:id/edit" element={<CreateLRPage />} />
          <Route path="/lr/:id" element={<LRDetailPage />} />

          {/* E-Way Bills */}
          <Route path="/lr/eway-bill" element={<EwayBillListPage />} />
          <Route path="/lr/eway-bill/new" element={<GenerateEwayBillPage />} />
          <Route path="/lr/eway-bill/:id/edit" element={<GenerateEwayBillPage />} />
          <Route path="/lr/eway-bill/:id" element={<EwayBillDetailPage />} />

          {/* Trips */}
          <Route path="/trips" element={<TripsPage />} />
          <Route path="/trips/new" element={<CreateTripPage />} />
          <Route path="/trips/:id/edit" element={<CreateTripPage />} />
          <Route path="/trips/:id" element={<TripDetailPage />} />

          {/* Documents */}
          <Route path="/documents" element={<DocumentListPage />} />
          <Route path="/documents/upload" element={<UploadDocumentPage />} />
          <Route path="/documents/:id/edit" element={<UploadDocumentPage />} />

          {/* Finance */}
          <Route path="/finance/invoices" element={<InvoicesPage />} />
          <Route path="/finance/payments" element={<PaymentsPage />} />
          <Route path="/finance/ledger" element={<LedgerPage />} />
          <Route path="/finance/receivables" element={<ReceivablesPage />} />
          <Route path="/finance/payables" element={<PayablesPage />} />
          <Route path="/finance/banking/new" element={<BankingEntryPage />} />

          {/* Tracking */}
          <Route path="/tracking" element={<LiveTrackingPage />} />
          <Route path="/tracking/gps" element={<GPSLiveMapPage />} />
          <Route path="/tracking/replay" element={<TripReplayPage />} />
          <Route path="/alerts" element={<FleetAlertsPage />} />

          {/* Reports */}
          <Route path="/reports" element={<ReportsPage />} />

          {/* Settings */}
          <Route path="/settings" element={<SettingsPage />} />

          {/* Compliance & Tools */}
          <Route path="/fleet/vehicle-compliance" element={<VehicleCompliancePage />} />
          <Route path="/fleet/driver-compliance" element={<DriverCompliancePage />} />
          <Route path="/fleet/gst-verify" element={<GSTVerificationPage />} />
          <Route path="/fleet/fuel-prices" element={<FuelPricePage />} />
          <Route path="/trips/route-calculator" element={<RouteCalculatorPage />} />
          <Route path="/finance/payment-link" element={<PaymentLinkPage />} />
          <Route path="/settings/notifications" element={<NotificationCenterPage />} />
          <Route path="/documents/new-upload" element={<DocumentUploadPage />} />

          {/* Fleet Manager */}
          <Route path="/fleet/dashboard" element={<FleetDashboardPage />} />
          <Route path="/fleet" element={<FleetDashboardPage />} />
          <Route path="/fleet/vehicles" element={<FleetVehiclesPage />} />
          <Route path="/fleet/vehicles/:id" element={<FleetVehiclesPage />} />
          <Route path="/fleet/drivers" element={<FleetDriversPage />} />
          <Route path="/fleet/drivers/:id" element={<FleetDriversPage />} />
          <Route path="/fleet/tracking" element={<FleetTrackingPage />} />
          <Route path="/fleet/maintenance" element={<ServicePage />} />
          <Route path="/fleet/fuel" element={<FuelPage />} />
          <Route path="/fleet/tyres" element={<TyrePage />} />
          <Route path="/fleet/alerts" element={<FleetAlertsPage />} />
          <Route path="/fleet/reports" element={<FleetReportsPage />} />

          {/* Masters */}
          <Route path="/routes" element={<RoutesPage />} />

          {/* Accountant */}
          <Route path="/accountant/dashboard" element={<AccountantDashboardPage />} />
          <Route path="/accountant" element={<AccountantDashboardPage />} />
          <Route path="/accountant/invoices" element={<AccountantInvoicesPage />} />
          <Route path="/accountant/receivables" element={<AccountantReceivablesPage />} />
          <Route path="/accountant/payables" element={<AccountantPayablesPage />} />
          <Route path="/accountant/expenses" element={<AccountantExpensesPage />} />
          <Route path="/accountant/fuel" element={<AccountantFuelExpensePage />} />
          <Route path="/accountant/banking" element={<AccountantBankingPage />} />
          <Route path="/accountant/ledger" element={<AccountantLedgerPage />} />
          <Route path="/accountant/reports" element={<AccountantReportsPage />} />

          {/* Admin */}
          <Route
            path="/admin/connectivity"
            element={
              <AuthGuard requiredRole="admin">
                <ConnectivityPage />
              </AuthGuard>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AuthGuard requiredRole="admin">
                <ConnectivityPage />
              </AuthGuard>
            }
          />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
