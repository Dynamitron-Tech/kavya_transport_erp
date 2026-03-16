import toast from 'react-hot-toast';

export const handleApiError = (error: any, fallback = 'Operation failed') => {
  const detail = error?.response?.data?.detail;
  const message = error?.response?.data?.message;

  if (Array.isArray(detail)) {
    const errors = detail
      .map((e: any) => `${Array.isArray(e?.loc) ? e.loc.join('.') : 'field'} - ${e?.msg || 'Invalid value'}`)
      .join('\n');
    toast.error(`Validation error:\n${errors}`, { duration: 6000 });
    return;
  }

  const text = typeof detail === 'string' ? detail : message || JSON.stringify(error?.response?.data || '') || fallback;
  toast.error(text || fallback);
  // Keep a full payload in console for quick backend debugging.
  // eslint-disable-next-line no-console
  console.error('API Error:', error?.response?.data || error);
};
