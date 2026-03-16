import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Truck, Eye, EyeOff, Shield, Zap, BarChart3 } from 'lucide-react';
import { getRoleHomePage } from '@/utils/roleRouting';
import { SubmitButton } from '@/components/common/SubmitButton';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await login(email, password);
      const nextRole = useAuthStore.getState().user?.roles?.[0];
      navigate(getRoleHomePage(nextRole), { replace: true });
    } catch {
      // error is set in the store
    }
  };

  const demoRoles = [
    { label: 'Admin', email: 'admin@kavyatransports.com', password: 'admin123', color: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
    { label: 'Manager', email: 'manager@kavyatransports.com', password: 'demo123', color: 'bg-purple-50 text-purple-700 ring-purple-600/20' },
    { label: 'Fleet Manager', email: 'fleet@kavyatransports.com', password: 'demo123', color: 'bg-green-50 text-green-700 ring-green-600/20' },
    { label: 'Accountant', email: 'accountant@kavyatransports.com', password: 'demo123', color: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
    { label: 'Project Associate', email: 'pa@kavyatransports.com', password: 'demo123', color: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20' },
    { label: 'Driver', email: 'driver@kavyatransports.com', password: 'demo123', color: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left: Branding panel */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 p-10 flex-col justify-between relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20">
              <Truck size={22} className="text-white" />
            </div>
            <h1 className="text-white text-xl font-bold tracking-tight">TransportERP</h1>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-white text-3xl xl:text-4xl font-bold leading-tight tracking-tight">
            Enterprise Fleet<br />Management System
          </h2>
          <p className="text-primary-200 text-sm leading-relaxed max-w-sm">
            Complete transport operations management — from job creation to invoice settlement.
            Track vehicles, manage trips, and handle finances all in one place.
          </p>

          <div className="space-y-3 pt-2">
            {[
              { icon: <Shield size={16} />, text: 'Role-based access control with 6 user roles' },
              { icon: <Zap size={16} />, text: 'Real-time GPS tracking and fleet monitoring' },
              { icon: <BarChart3 size={16} />, text: 'Advanced analytics and financial reporting' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-primary-100 text-sm">
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">{f.icon}</div>
                {f.text}
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex gap-8 text-primary-200 text-sm">
          <div>
            <p className="text-white text-2xl font-bold">500+</p>
            <p className="text-xs mt-0.5">Vehicles tracked</p>
          </div>
          <div>
            <p className="text-white text-2xl font-bold">10k+</p>
            <p className="text-xs mt-0.5">Trips completed</p>
          </div>
          <div>
            <p className="text-white text-2xl font-bold">99.9%</p>
            <p className="text-xs mt-0.5">Uptime SLA</p>
          </div>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-surface">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center">
              <Truck size={20} className="text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900">TransportERP</h1>
          </div>

          <div className="bg-white rounded-xl shadow-card border border-card-border p-8">
            <div className="text-center mb-7">
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">Welcome back</h2>
              <p className="text-sm text-gray-500 mt-1">Sign in to your account to continue</p>
            </div>

            {error && (
              <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@transporterp.com"
                  className="input-field"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="input-field pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-3.5 h-3.5" />
                  <span className="text-sm text-gray-600">Remember me</span>
                </label>
                <a href="#" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                  Forgot password?
                </a>
              </div>

              <SubmitButton
                isLoading={isLoading}
                label="Sign in"
                loadingLabel="Signing in..."
                className="w-full flex items-center justify-center py-2.5"
              />
            </form>

            {/* Demo credentials */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Login</p>
              <div className="flex flex-wrap gap-1.5">
                {demoRoles.map((role) => (
                  <button
                    key={role.label}
                    onClick={() => { setEmail(role.email); setPassword(role.password); }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-full ring-1 ring-inset transition-all hover:scale-105 ${role.color}`}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-2">Click any role to auto-fill credentials</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
