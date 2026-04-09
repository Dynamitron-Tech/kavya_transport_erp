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

// Finance Hub
import FinanceHubPage from '@/pages/finance/FinanceHubPage';

// Banking Module
import BankingPage from '@/pages/banking/BankingPage';

// Tracking
import LiveTrackingPage from '@/pages/tracking/LiveTrackingPage';
import GPSLiveMapPage from '@/pages/tracking/GPSLiveMapPage';
import TripReplayPage from '@/pages/tracking/TripReplayPage';
import UnifiedTrackingPage from '@/pages/tracking/UnifiedTrackingPage';

// Reports
import ReportsPage from '@/pages/reports/ReportsPage';
import AuditorReportPage from '@/pages/reports/AuditorReportPage';

// Compliance & Tools
import VehicleCompliancePage from '@/pages/fleet/VehicleCompliancePage';
import DriverCompliancePage from '@/pages/fleet/DriverCompliancePage';
import GSTVerificationPage from '@/pages/fleet/GSTVerificationPage';
import FuelPricePage from '@/pages/fleet/FuelPricePage';
import RouteCalculatorPage from '@/pages/trips/RouteCalculatorPage';
import PaymentLinkPage from '@/pages/finance/PaymentLinkPage';
import PaymentsHubPage from '@/pages/finance/PaymentsHubPage';
import NotificationCenterPage from '@/pages/settings/NotificationCenterPage';
import DocumentUploadPage from '@/pages/documents/DocumentUploadPage';

// Settings
import SettingsPage from '@/pages/settings/SettingsPage';
import ProfilePage from '@/pages/settings/ProfilePage';

// Fleet Manager
import FleetDashboardPage from '@/pages/fleet/FleetDashboardPage';
import FleetVehiclesPage from '@/pages/fleet/FleetVehiclesPage';
import FleetAssignDriverPage from '@/pages/fleet/FleetAssignDriverPage';
import FleetDriversPage from '@/pages/fleet/FleetDriversPage';
import FleetTrackingPage from '@/pages/fleet/FleetTrackingPage';
import FleetMaintenancePage from '@/pages/fleet/FleetMaintenancePage';
import FleetFuelPage from '@/pages/fleet/FleetFuelPage';
import FleetAlertsPage from '@/pages/fleet/FleetAlertsPage';
import FleetReportsPage from '@/pages/fleet/FleetReportsPage';
import TyrePage from '@/pages/fleet/TyrePage';
import TyreTrackerPage from '@/pages/fleet/TyreTrackerPage';
import GeofenceManagementPage from '@/pages/fleet/GeofenceManagementPage';
import ComplianceDashboardPage from '@/pages/fleet/ComplianceDashboardPage';
import DriverLeaderboardPage from '@/pages/fleet/DriverLeaderboardPage';
import TPMSDashboardPage from '@/pages/fleet/TPMSDashboardPage';
import CustomerLoginPage from '@/pages/portal/CustomerLoginPage';
import CustomerDashboardPage from '@/pages/portal/CustomerDashboardPage';
import CustomerTrackingPage from '@/pages/portal/CustomerTrackingPage';
import SupplierLoginPage from '@/pages/portal/SupplierLoginPage';
import SupplierDashboardPage from '@/pages/portal/SupplierDashboardPage';
import RoutesPage from '@/pages/masters/RoutesPage';
import SuppliersPage from '@/pages/suppliers/SuppliersPage';
import SupplierDetailPage from '@/pages/suppliers/SupplierDetailPage';
import MarketTripsPage from '@/pages/market-trips/MarketTripsPage';
import MarketTripDetailPage from '@/pages/market-trips/MarketTripDetailPage';

// Pump Operator
import PumpDashboardPage from '@/pages/pump/PumpDashboardPage';
import PumpIssueFuelPage from '@/pages/pump/PumpIssueFuelPage';
import PumpFuelLogPage from '@/pages/pump/PumpFuelLogPage';
import PumpStockPage from '@/pages/pump/PumpStockPage';
import PumpAlertsPage from '@/pages/pump/PumpAlertsPage';
import PumpReportsPage from '@/pages/pump/PumpReportsPage';
import FuelVerificationPage from '@/pages/pump/FuelVerificationPage';

// Accountant
import AccountantDashboardPage from '@/pages/accountant/AccountantDashboardPage';
import AccountantInvoicesPage from '@/pages/accountant/AccountantInvoicesPage';
import AccountantReceivablesPage from '@/pages/accountant/AccountantReceivablesPage';
import AccountantPayablesPage from '@/pages/accountant/AccountantPayablesPage';
import AccountantExpensesPage from '@/pages/accountant/AccountantExpensesPage';
import AccountantDriverPaymentsPage from '@/pages/accountant/AccountantDriverPaymentsPage';
import AccountantFuelExpensePage from '@/pages/accountant/AccountantFuelExpensePage';
import AccountantBankingPage from '@/pages/accountant/AccountantBankingPage';
import AccountantLedgerPage from '@/pages/accountant/AccountantLedgerPage';
import AccountantReportsPage from '@/pages/accountant/AccountantReportsPage';
// Finance Manager
import FinanceManagerDashboardPage from '@/pages/finance-manager/FinanceManagerDashboardPage';
import SalaryPaymentsPage from '@/pages/finance-manager/SalaryPaymentsPage';
import ExpenseApprovalsPage from '@/pages/finance-manager/ExpenseApprovalsPage';
import PayablesDashboardPage from '@/pages/finance-manager/PayablesDashboardPage';
import PayoutHistoryPage from '@/pages/finance-manager/PayoutHistoryPage';

// IFIAS (Accountant)
import InvoiceWorkspacePage from '@/pages/finance/InvoiceWorkspacePage';

import ConnectivityPage from '@/pages/admin/ConnectivityPage';
import EmployeesPage from '@/pages/admin/EmployeesPage';
import AttendancePage from '@/pages/admin/AttendancePage';
import BranchesPage from '@/pages/admin/BranchesPage';
import BranchDetailPage from '@/pages/admin/BranchDetailPage';
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
          <Route path="/my-work/attendance" element={<DriverAttendancePage />} />
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

          {/* Finance Hub — single route with tab-based navigation */}
          <Route path="/finance" element={<FinanceHubPage />} />
          {/* Backward-compat redirects from old finance routes */}
          <Route path="/finance/invoices" element={<Navigate to="/finance?tab=invoices" replace />} />
          <Route path="/finance/invoice-workspace" element={<Navigate to="/finance?tab=invoices" replace />} />
          <Route path="/finance/payments" element={<Navigate to="/finance?tab=transactions&sub=receivables" replace />} />
          <Route path="/finance/receivables" element={<Navigate to="/finance?tab=transactions&sub=receivables" replace />} />
          <Route path="/finance/payables" element={<Navigate to="/finance?tab=transactions&sub=payables" replace />} />
          <Route path="/finance/ledger" element={<Navigate to="/finance?tab=banking&view=ledger" replace />} />
          <Route path="/finance/reconciliation" element={<Navigate to="/finance?tab=banking&view=reconciliation" replace />} />
          <Route path="/finance/settlements" element={<Navigate to="/finance?tab=transactions&sub=settlements" replace />} />
          <Route path="/finance/alerts" element={<Navigate to="/finance?tab=overview" replace />} />
          <Route path="/finance/reports" element={<Navigate to="/finance?tab=reports" replace />} />
          {/* Banking entry form stays as dedicated page */}
          <Route path="/finance/banking/new" element={<Navigate to="/finance?tab=banking" replace />} />


          {/* Banking Module */}
          <Route path="/banking" element={<BankingPage />} />

          {/* Tracking */}
          <Route path="/tracking" element={<UnifiedTrackingPage />} />
          <Route path="/tracking/unified" element={<UnifiedTrackingPage />} />
          <Route path="/tracking/live" element={<LiveTrackingPage />} />
          <Route path="/tracking/gps" element={<GPSLiveMapPage />} />
          <Route path="/tracking/replay" element={<TripReplayPage />} />
          <Route path="/alerts" element={<FleetAlertsPage />} />

          {/* Reports */}
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/reports/auditor" element={<AuditorReportPage />} />

          {/* Settings */}
          <Route path="/settings" element={<SettingsPage />} />

          {/* Compliance & Tools */}
          <Route path="/fleet/vehicle-compliance" element={<VehicleCompliancePage />} />
          <Route path="/fleet/driver-compliance" element={<DriverCompliancePage />} />
          <Route path="/fleet/gst-verify" element={<GSTVerificationPage />} />
          <Route path="/fleet/fuel-prices" element={<FuelPricePage />} />
          <Route path="/trips/route-calculator" element={<RouteCalculatorPage />} />
          <Route path="/finance/payment-link" element={<PaymentLinkPage />} />
          <Route path="/finance/payments-hub" element={<PaymentsHubPage />} />
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
          <Route path="/fleet/maintenance" element={<FleetMaintenancePage />} />
          <Route path="/fleet/fuel" element={<FleetFuelPage />} />
          <Route path="/fleet/tyres" element={<TyreTrackerPage />} />
          <Route path="/fleet/tyres-old" element={<TyrePage />} />
          <Route path="/fleet/alerts" element={<FleetAlertsPage />} />
          <Route path="/fleet/reports" element={<FleetReportsPage />} />
          <Route path="/fleet/geofences" element={<GeofenceManagementPage />} />
          <Route path="/fleet/compliance" element={<ComplianceDashboardPage />} />
          <Route path="/fleet/driver-leaderboard" element={<DriverLeaderboardPage />} />
          <Route path="/fleet/tpms" element={<TPMSDashboardPage />} />
          <Route path="/fleet/assign-drivers" element={<FleetAssignDriverPage />} />

          {/* Masters */}
          <Route path="/routes" element={<RoutesPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/suppliers/:id" element={<SupplierDetailPage />} />

          {/* Market Trips */}
          <Route path="/market-trips" element={<MarketTripsPage />} />
          <Route path="/market-trips/:id" element={<MarketTripDetailPage />} />

          {/* Accountant */}
          <Route path="/accountant/dashboard" element={<AccountantDashboardPage />} />
          <Route path="/accountant" element={<AccountantDashboardPage />} />
          <Route path="/accountant/invoice-workspace" element={<InvoiceWorkspacePage />} />
          <Route path="/accountant/invoices" element={<AuthGuard requiredPermission="invoice:read"><AccountantInvoicesPage /></AuthGuard>} />
          <Route path="/accountant/receivables" element={<AuthGuard requiredPermission="invoice:read"><AccountantReceivablesPage /></AuthGuard>} />
          <Route path="/accountant/payables" element={<AuthGuard requiredPermission="payment:read"><AccountantPayablesPage /></AuthGuard>} />
          <Route path="/accountant/expenses" element={<AuthGuard requiredPermission="expense:read"><AccountantExpensesPage /></AuthGuard>} />
          <Route path="/accountant/payments" element={<AuthGuard requiredPermission="payment:read"><AccountantDriverPaymentsPage /></AuthGuard>} />
          <Route path="/accountant/fuel" element={<AccountantFuelExpensePage />} />
          <Route path="/accountant/banking" element={<AccountantBankingPage />} />
          <Route path="/accountant/ledger" element={<AuthGuard requiredPermission="ledger:read"><AccountantLedgerPage /></AuthGuard>} />
          <Route path="/accountant/reports" element={<AccountantReportsPage />} />

          {/* Finance Manager */}
          <Route path="/fm/dashboard" element={<FinanceManagerDashboardPage />} />
          <Route path="/fm" element={<FinanceManagerDashboardPage />} />
          <Route path="/fm/salary" element={<SalaryPaymentsPage />} />
          <Route path="/fm/advances" element={<SalaryPaymentsPage />} />
          <Route path="/fm/expenses" element={<ExpenseApprovalsPage />} />
          <Route path="/fm/payables" element={<PayablesDashboardPage />} />
          <Route path="/fm/history" element={<PayoutHistoryPage />} />

          {/* Pump Operator */}
          <Route path="/pump/dashboard" element={<PumpDashboardPage />} />
          <Route path="/pump" element={<PumpDashboardPage />} />
          <Route path="/pump/issue" element={<PumpIssueFuelPage />} />
          <Route path="/pump/log" element={<PumpFuelLogPage />} />
          <Route path="/pump/stock" element={<PumpStockPage />} />
          <Route path="/pump/alerts" element={<PumpAlertsPage />} />
          <Route path="/pump/reports" element={<PumpReportsPage />} />
          <Route path="/pump/fuel-verification" element={<FuelVerificationPage />} />

          {/* Profile page */}
          <Route path="/profile" element={<ProfilePage />} />

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
                <EmployeesPage />
              </AuthGuard>
            }
          />
          <Route
            path="/admin/employees"
            element={
              <AuthGuard requiredRole="admin">
                <EmployeesPage />
              </AuthGuard>
            }
          />
          <Route
            path="/admin/attendance"
            element={
              <AuthGuard requiredRole="admin">
                <AttendancePage />
              </AuthGuard>
            }
          />
          <Route
            path="/admin/branches"
            element={
              <AuthGuard requiredRole="admin">
                <BranchesPage />
              </AuthGuard>
            }
          />
          <Route
            path="/admin/branches/:id"
            element={
              <AuthGuard requiredRole="admin">
                <BranchDetailPage />
              </AuthGuard>
            }
          />
        </Route>

        {/* Portal routes (standalone, no AuthGuard/DashboardLayout) */}
        <Route path="/portal/customer" element={<CustomerLoginPage />} />
        <Route path="/portal/customer/dashboard" element={<CustomerDashboardPage />} />
        <Route path="/portal/track/:token" element={<CustomerTrackingPage />} />
        <Route path="/portal/supplier" element={<SupplierLoginPage />} />
        <Route path="/portal/supplier/dashboard" element={<SupplierDashboardPage />} />

        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Catch all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
