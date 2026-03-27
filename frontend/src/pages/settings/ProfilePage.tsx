import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Camera, Save, User } from 'lucide-react';
import toast from 'react-hot-toast';

import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

export default function ProfilePage() {
  const { user, fetchUser } = useAuthStore();
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('');

  useEffect(() => {
    setPhotoDataUrl(user?.avatar_url || '');
  }, [user?.avatar_url]);

  const displayName = useMemo(() => {
    const name = `${user?.first_name || ''} ${user?.last_name || ''}`.trim();
    return name || user?.full_name || user?.email || 'User';
  }, [user?.first_name, user?.last_name, user?.full_name, user?.email]);

  const toDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const updatePhotoMutation = useMutation({
    mutationFn: async () => {
      return api.put('/auth/me/photo', { avatar_url: photoDataUrl });
    },
    onSuccess: async () => {
      await fetchUser();
      toast.success('Profile photo updated');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to update profile photo';
      toast.error(msg);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">My Profile</h1>
        <p className="page-subtitle">View your employee details and update your photo</p>
      </div>

      <div className="card p-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-72">
            <div className="rounded-2xl border border-gray-200 p-4 bg-gray-50">
              <div className="flex items-center justify-center mb-4">
                {photoDataUrl ? (
                  <img
                    src={photoDataUrl}
                    alt="Profile"
                    className="w-32 h-32 rounded-full object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="w-12 h-12 text-blue-600" />
                  </div>
                )}
              </div>

              <label className="block text-sm font-medium text-gray-700 mb-2">Change Photo</label>
              <input
                type="file"
                accept="image/*"
                className="input w-full"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = await toDataUrl(file);
                  setPhotoDataUrl(url);
                }}
              />

              <button
                type="button"
                className="btn-primary w-full mt-3 flex items-center justify-center gap-2"
                onClick={() => updatePhotoMutation.mutate()}
                disabled={updatePhotoMutation.isPending || !photoDataUrl}
              >
                {updatePhotoMutation.isPending ? (
                  'Saving...'
                ) : (
                  <>
                    <Save size={16} /> Save Photo
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Employee Name</p>
                <p className="text-sm font-semibold text-gray-900">{displayName}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Employee ID</p>
                <p className="text-sm font-semibold text-gray-900">{user?.id || '-'}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4 border border-gray-100 md:col-span-2">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Email</p>
                <p className="text-sm font-semibold text-gray-900 break-all">{user?.email || '-'}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Phone</p>
                <p className="text-sm font-semibold text-gray-900">{user?.phone || '-'}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Role</p>
                <p className="text-sm font-semibold text-gray-900 capitalize">{user?.roles?.[0]?.replace('_', ' ') || '-'}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Status</p>
                <p className="text-sm font-semibold text-gray-900">{user?.is_active === false ? 'Inactive' : 'Active'}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Joined Date</p>
                <p className="text-sm font-semibold text-gray-900">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-IN') : '-'}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
              <div className="flex items-start gap-2">
                <Camera size={16} className="mt-0.5" />
                <p>Only profile photo can be changed here. Other employee details are read-only.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
