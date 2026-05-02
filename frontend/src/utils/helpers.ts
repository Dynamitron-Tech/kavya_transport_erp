/**
 * Open a document URL in a new tab.
 * Chrome blocks navigation to data: URLs via <a target="_blank"> or window.open,
 * showing a black screen. This converts them to Blob URLs first.
 * For S3 presigned URLs, a HEAD pre-check is performed so a missing file
 * shows a toast error instead of the raw S3 XML error page.
 */
export async function openDocumentUrl(fileUrl: string | null | undefined): Promise<void> {
  if (!fileUrl) return;
  if (fileUrl.startsWith('data:')) {
    try {
      const [header, b64] = fileUrl.split(',');
      const mime = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
      const bytes = atob(b64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const blob = new Blob([arr], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      const tab = window.open(blobUrl, '_blank', 'noreferrer');
      if (tab) setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    } catch {
      window.open(fileUrl, '_blank', 'noreferrer');
    }
    return;
  }

  // For S3 presigned URLs, do a HEAD check before opening.
  // If the file is missing S3 returns 403/404 — catch it and show a toast.
  if (fileUrl.includes('X-Amz-Algorithm=') || fileUrl.includes('.s3.') || fileUrl.includes('.s3.amazonaws.com')) {
    try {
      const res = await fetch(fileUrl, { method: 'HEAD' });
      if (!res.ok) {
        const { default: toast } = await import('react-hot-toast');
        toast.error('File not found in storage. Please re-upload the document.');
        return;
      }
    } catch {
      // CORS or network error — open anyway; browser will show whatever it can
    }
  }

  window.open(fileUrl, '_blank', 'noreferrer');
}

export const safeArray = <T>(val: any): T[] => {
  if (Array.isArray(val)) return val;
  if (Array.isArray(val?.data)) return val.data;
  if (Array.isArray(val?.items)) return val.items;
  if (Array.isArray(val?.results)) return val.results;
  if (Array.isArray(val?.records)) return val.records;
  return [];
};
