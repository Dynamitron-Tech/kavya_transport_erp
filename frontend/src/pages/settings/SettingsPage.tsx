import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/authService';
import {
  User, Lock, Bell, Palette, Shield, Building2,
  Save, Eye, EyeOff, Check, AlertCircle
} from 'lucide-react';

type SettingsTab = 'profile' | 'security' | 'notifications' | 'appearance' | 'company' | 'system';

export default function SettingsPage() {
  const { user, hasRole } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Profile state
  const [profile, setProfile] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  // Password state
  const [passwords, setPasswords] = useState({ current: '', new_password: '', confirm: '' });
  const [showPasswords, setShowPasswords] = useState({ current: false, new_password: false, confirm: false });

  // Notification prefs
  const [notifications, setNotifications] = useState({
    email_alerts: true, sms_alerts: false, trip_updates: true, payment_alerts: true,
    maintenance_reminders: true, daily_digest: false, weekly_report: true,
  });

  // Appearance
  const [appearance, setAppearance] = useState({ theme: 'light', density: 'comfortable', language: 'en' });

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: 'profile', label: 'Profile', icon: <User size={18} /> },
    { id: 'security', label: 'Security', icon: <Lock size={18} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette size={18} /> },
    { id: 'company', label: 'Company', icon: <Building2 size={18} />, adminOnly: true },
    { id: 'system', label: 'System', icon: <Shield size={18} />, adminOnly: true },
  ];

  const visibleTabs = tabs.filter((t) => !t.adminOnly || hasRole('admin'));

  const showMessage = (type: 'success' | 'error', message: string) => {
    if (type === 'success') { setSuccess(message); setError(''); }
    else { setError(message); setSuccess(''); }
    setTimeout(() => { setSuccess(''); setError(''); }, 3000);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // TODO: call updateProfile API
      showMessage('success', 'Profile updated successfully');
    } catch { showMessage('error', 'Failed to update profile'); }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (passwords.new_password !== passwords.confirm) {
      showMessage('error', 'Passwords do not match');
      return;
    }
    if (passwords.new_password.length < 8) {
      showMessage('error', 'Password must be at least 8 characters');
      return;
    }
    setSaving(true);
    try {
      await authService.changePassword(passwords.current, passwords.new_password);
      setPasswords({ current: '', new_password: '', confirm: '' });
      showMessage('success', 'Password changed successfully');
    } catch { showMessage('error', 'Failed to change password. Check your current password.'); }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account and system preferences</p>
        </div>
      </div>

      {(success || error) && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {success ? <Check size={16} /> : <AlertCircle size={16} />}
          {success || error}
        </div>
      )}

      <div className="flex gap-6">
        {/* Sidebar Tabs */}
        <div className="w-56 flex-shrink-0">
          <nav className="space-y-1">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* Profile */}
          {activeTab === 'profile' && (
            <div className="card space-y-6">
              <h3 className="font-semibold text-gray-900 text-lg">Profile Information</h3>
              <div className="flex items-center gap-4 pb-4 border-b">
                <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary-600">
                    {user?.full_name?.charAt(0) || 'U'}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{user?.full_name}</p>
                  <p className="text-sm text-gray-500 capitalize">{user?.roles?.[0]?.replace('_', ' ')}</p>
                  <button className="text-sm text-primary-600 hover:text-primary-700 mt-1">Change photo</button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Full Name</label>
                  <input className="input-field" value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input className="input-field" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input-field" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                </div>
                <div>
                  <label className="label">Role</label>
                  <input className="input-field bg-gray-50" value={user?.roles?.[0]?.replace('_', ' ') || ''} disabled />
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={handleSaveProfile} disabled={saving} className="btn-primary flex items-center gap-2">
                  <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* Security */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="card space-y-4">
                <h3 className="font-semibold text-gray-900 text-lg">Change Password</h3>
                {['current', 'new_password', 'confirm'].map((field) => (
                  <div key={field}>
                    <label className="label">{field === 'current' ? 'Current Password' : field === 'new_password' ? 'New Password' : 'Confirm New Password'}</label>
                    <div className="relative">
                      <input
                        className="input-field pr-10"
                        type={showPasswords[field as keyof typeof showPasswords] ? 'text' : 'password'}
                        value={passwords[field as keyof typeof passwords]}
                        onChange={(e) => setPasswords({ ...passwords, [field]: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords({ ...showPasswords, [field]: !showPasswords[field as keyof typeof showPasswords] })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPasswords[field as keyof typeof showPasswords] ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-end">
                  <button onClick={handleChangePassword} disabled={saving} className="btn-primary flex items-center gap-2">
                    <Lock size={16} /> {saving ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </div>
              <div className="card space-y-4">
                <h3 className="font-semibold text-gray-900 text-lg">Active Sessions</h3>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Current Session</p>
                      <p className="text-xs text-gray-500">Browser · {navigator.userAgent.includes('Mac') ? 'macOS' : 'Windows'}</p>
                    </div>
                  </div>
                  <span className="text-xs text-green-600 font-medium">Active</span>
                </div>
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeTab === 'notifications' && (
            <div className="card space-y-4">
              <h3 className="font-semibold text-gray-900 text-lg">Notification Preferences</h3>
              <p className="text-sm text-gray-500">Choose how you want to receive alerts and updates</p>
              {Object.entries(notifications).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div>
                    <p className="font-medium text-gray-900 text-sm capitalize">{key.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-500">
                      {key === 'email_alerts' && 'Receive alerts via email'}
                      {key === 'sms_alerts' && 'Receive alerts via SMS'}
                      {key === 'trip_updates' && 'Get notified on trip status changes'}
                      {key === 'payment_alerts' && 'Payment received/overdue notifications'}
                      {key === 'maintenance_reminders' && 'Vehicle maintenance due alerts'}
                      {key === 'daily_digest' && 'Daily summary of activities'}
                      {key === 'weekly_report' && 'Weekly performance report'}
                    </p>
                  </div>
                  <button
                    onClick={() => setNotifications({ ...notifications, [key]: !value })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-primary-600' : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5.5 left-0.5' : 'left-0.5'}`} />
                  </button>
                </div>
              ))}
              <div className="flex justify-end pt-2">
                <button className="btn-primary flex items-center gap-2" onClick={() => showMessage('success', 'Preferences saved')}>
                  <Save size={16} /> Save Preferences
                </button>
              </div>
            </div>
          )}

          {/* Appearance */}
          {activeTab === 'appearance' && (
            <div className="card space-y-6">
              <h3 className="font-semibold text-gray-900 text-lg">Appearance Settings</h3>
              <div>
                <label className="label">Theme</label>
                <div className="grid grid-cols-3 gap-3">
                  {['light', 'dark', 'system'].map((theme) => (
                    <button
                      key={theme}
                      onClick={() => setAppearance({ ...appearance, theme })}
                      className={`p-4 rounded-lg border-2 text-center capitalize text-sm font-medium transition-colors ${
                        appearance.theme === theme ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Density</label>
                <div className="grid grid-cols-3 gap-3">
                  {['compact', 'comfortable', 'spacious'].map((density) => (
                    <button
                      key={density}
                      onClick={() => setAppearance({ ...appearance, density })}
                      className={`p-4 rounded-lg border-2 text-center capitalize text-sm font-medium transition-colors ${
                        appearance.density === density ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {density}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Language</label>
                <select className="input-field" value={appearance.language} onChange={(e) => setAppearance({ ...appearance, language: e.target.value })}>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="ta">Tamil</option>
                  <option value="te">Telugu</option>
                  <option value="kn">Kannada</option>
                </select>
              </div>
              <div className="flex justify-end">
                <button className="btn-primary flex items-center gap-2" onClick={() => showMessage('success', 'Appearance settings saved')}>
                  <Save size={16} /> Save
                </button>
              </div>
            </div>
          )}

          {/* Company (Admin only) */}
          {activeTab === 'company' && (
            <div className="card space-y-6">
              <h3 className="font-semibold text-gray-900 text-lg">Company Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Company Name</label>
                  <input className="input-field" placeholder="Transport Corp Pvt Ltd" />
                </div>
                <div>
                  <label className="label">GST Number</label>
                  <input className="input-field" placeholder="29AABCU9603R1ZM" />
                </div>
                <div>
                  <label className="label">PAN Number</label>
                  <input className="input-field" placeholder="AABCU9603R" />
                </div>
                <div>
                  <label className="label">TAN Number</label>
                  <input className="input-field" placeholder="" />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Registered Address</label>
                  <textarea className="input-field" rows={3} placeholder="123 Transport Nagar, City, State - 560001" />
                </div>
                <div>
                  <label className="label">Contact Email</label>
                  <input className="input-field" type="email" placeholder="info@transportcorp.com" />
                </div>
                <div>
                  <label className="label">Contact Phone</label>
                  <input className="input-field" placeholder="+91 98765 43210" />
                </div>
              </div>
              <div className="flex justify-end">
                <button className="btn-primary flex items-center gap-2">
                  <Save size={16} /> Save Company Info
                </button>
              </div>
            </div>
          )}

          {/* System (Admin only) */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <div className="card space-y-4">
                <h3 className="font-semibold text-gray-900 text-lg">System Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Default Currency</label>
                    <select className="input-field">
                      <option>INR (₹)</option>
                      <option>USD ($)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Date Format</label>
                    <select className="input-field">
                      <option>DD/MM/YYYY</option>
                      <option>MM/DD/YYYY</option>
                      <option>YYYY-MM-DD</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Timezone</label>
                    <select className="input-field">
                      <option>Asia/Kolkata (IST)</option>
                      <option>UTC</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Financial Year Start</label>
                    <select className="input-field">
                      <option>April</option>
                      <option>January</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="card space-y-4">
                <h3 className="font-semibold text-gray-900 text-lg">Auto-numbering</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">LR Number Prefix</label>
                    <input className="input-field" defaultValue="LR-" />
                  </div>
                  <div>
                    <label className="label">Invoice Number Prefix</label>
                    <input className="input-field" defaultValue="INV-" />
                  </div>
                  <div>
                    <label className="label">Trip Number Prefix</label>
                    <input className="input-field" defaultValue="TRP-" />
                  </div>
                  <div>
                    <label className="label">Job Number Prefix</label>
                    <input className="input-field" defaultValue="JOB-" />
                  </div>
                </div>
              </div>
              <div className="card space-y-4">
                <h3 className="font-semibold text-gray-900 text-lg">GPS & Tracking</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">GPS Provider</label>
                    <select className="input-field">
                      <option>Auto Detect</option>
                      <option>Google Maps</option>
                      <option>Mapbox</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Tracking Interval (seconds)</label>
                    <input className="input-field" type="number" defaultValue={30} />
                  </div>
                  <div>
                    <label className="label">Speed Alert Threshold (km/h)</label>
                    <input className="input-field" type="number" defaultValue={80} />
                  </div>
                  <div>
                    <label className="label">Geofence Radius (meters)</label>
                    <input className="input-field" type="number" defaultValue={500} />
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button className="btn-primary flex items-center gap-2">
                  <Save size={16} /> Save System Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
