import type {
  User, Client, Vehicle, Driver, Job, LR, Trip, Invoice, DashboardStats,
} from '@/types';

export const mockUser: User = {
  id: 1,
  email: 'admin@kavyatransports.com',
  full_name: 'Admin User',
  phone: '9876543210',
  is_active: true,
  roles: ['admin'],
  permissions: ['*'],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

export const mockDriverUser: User = {
  id: 2,
  email: 'driver@kavyatransports.com',
  full_name: 'Driver User',
  phone: '9876543211',
  is_active: true,
  roles: ['driver'],
  permissions: ['trips:view', 'trips:update_status'],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

export const mockClient: Client = {
  id: 1,
  name: 'Test Corp',
  code: 'TC001',
  client_type: 'corporate',
  gst_number: '29ABCDE1234F1Z5',
  email: 'testcorp@example.com',
  phone: '9876543210',
  billing_address: '123 Test St',
  billing_city: 'Bangalore',
  billing_state: 'Karnataka',
  billing_pincode: '560001',
  credit_limit: 500000,
  credit_days: 30,
  is_active: true,
  outstanding_amount: 25000,
  total_jobs: 15,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
} as unknown as Client;

export const mockVehicle: Vehicle = {
  id: 1,
  registration_number: 'KA01AB1234',
  vehicle_type: 'truck',
  make: 'Tata',
  model: 'Prima',
  year: 2022,
  ownership_type: 'owned',
  status: 'available',
  fuel_type: 'diesel',
  capacity_tons: 25,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
} as unknown as Vehicle;

export const mockDriver: Driver = {
  id: 1,
  user_id: 2,
  employee_id: 'DRV001',
  full_name: 'Raju Kumar',
  phone: '9876543211',
  license_number: 'KA0120210001234',
  license_type: 'HMV',
  license_expiry: '2025-12-31',
  status: 'available',
  is_active: true,
  total_trips: 50,
  current_vehicle_id: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
} as unknown as Driver;

export const mockJob: Job = {
  id: 1,
  job_number: 'JOB-2024-0001',
  client_id: 1,
  client_name: 'Test Corp',
  origin: 'Bangalore',
  destination: 'Chennai',
  material_type: 'Electronics',
  weight_tons: 10,
  contract_type: 'per_trip',
  agreed_rate: 25000,
  status: 'approved',
  priority: 'medium',
  pickup_date: '2024-02-01',
  delivery_date: '2024-02-03',
  created_at: '2024-01-15T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
} as unknown as Job;

export const mockLR: LR = {
  id: 1,
  lr_number: 'LR-2024-0001',
  job_id: 1,
  trip_id: 1,
  consignor_name: 'Test Corp',
  consignee_name: 'Receiver Inc',
  origin: 'Bangalore',
  destination: 'Chennai',
  material_description: 'Electronics',
  weight: 10000,
  num_packages: 50,
  status: 'generated',
  payment_mode: 'to_pay',
  declared_value: 500000,
  created_at: '2024-01-20T00:00:00Z',
  updated_at: '2024-01-20T00:00:00Z',
} as unknown as LR;

export const mockTrip: Trip = {
  id: 1,
  trip_number: 'TRP-2024-0001',
  vehicle_id: 1,
  driver_id: 1,
  origin: 'Bangalore',
  destination: 'Chennai',
  status: 'planned',
  start_date: '2024-02-01',
  estimated_arrival: '2024-02-03',
  distance_km: 350,
  created_at: '2024-01-20T00:00:00Z',
  updated_at: '2024-01-20T00:00:00Z',
} as unknown as Trip;

export const mockInvoice: Invoice = {
  id: 1,
  invoice_number: 'INV-2024-0001',
  client_id: 1,
  client_name: 'Test Corp',
  invoice_type: 'client',
  status: 'draft',
  subtotal: 25000,
  tax_amount: 4500,
  total_amount: 29500,
  paid_amount: 0,
  balance_amount: 29500,
  issue_date: '2024-02-01',
  due_date: '2024-03-01',
  created_at: '2024-02-01T00:00:00Z',
  updated_at: '2024-02-01T00:00:00Z',
} as unknown as Invoice;

export const mockDashboardStats: DashboardStats = {
  total_vehicles: 25,
  active_trips: 8,
  total_drivers: 30,
  monthly_revenue: 2500000,
  available_vehicles: 15,
  on_trip_vehicles: 8,
  maintenance_vehicles: 2,
  total_clients: 45,
  pending_invoices: 12,
  overdue_payments: 3,
} as unknown as DashboardStats;

export const mockPaginatedResponse = <T>(items: T[]) => ({
  items,
  total: items.length,
  page: 1,
  page_size: 20,
  pages: 1,
});
