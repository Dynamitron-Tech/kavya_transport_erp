import api from './api';

export interface ProcessingBatch {
  id: number;
  transporter_name: string;
  client_name: string | null;
  billing_period: string | null;
  status: string;
  total_lrs: number;
  processed_lrs: number;
  approved_lrs: number;
  review_lrs: number;
  rejected_lrs: number;
  confirmed_lrs: number;
  triggered_by: string;
  created_at: string | null;
  completed_at: string | null;
  exported_at: string | null;
  source_excel_path: string | null;
  error_message: string | null;
}

export interface ValidationFlag {
  field: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  value_found: string | null;
  value_expected: string | null;
}

export interface IfiasLineItem {
  id: number;
  batch_id: number;
  lr_number: string;
  truck_number: string | null;
  sat_slip_no: string | null;
  detention_days: number | null;
  truck_type: string | null;
  truck_type_verified: string | null;
  detention_days_verified: number | null;
  sat_slip_no_verified: string | null;
  shipment_no: string | null;
  region: string | null;
  from_location: string | null;
  to_location: string | null;
  total_units: number | null;
  total_wt: number | null;
  shortage: number | null;
  detention_charge: number | null;
  master_rate: number | null;
  payable: number | null;
  remarks: string | null;
  processing_status: string;
  confidence_score: number | null;
  extraction_method: string | null;
  auto_filled: boolean;
  manually_reviewed: boolean;
  flags: ValidationFlag[];
  auto_fill_data: Record<string, any>;
  source_pdf_s3: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  confirmed_at: string | null;
  excel_row_number: number | null;
  created_at: string | null;
}

const unwrap = (data: any) => data?.data ?? data;

export const invoiceWorkspaceService = {
  listBatches: async (params?: { page?: number; limit?: number; status?: string }) => {
    const res = await api.get('/invoice-batches', { params });
    return res as { data: ProcessingBatch[]; pagination: { total: number; page: number; pages: number } };
  },

  getBatch: async (id: number): Promise<ProcessingBatch> => {
    const res = await api.get(`/invoice-batches/${id}`);
    return unwrap(res);
  },

  listLineItems: async (
    batchId: number,
    params?: { page?: number; limit?: number; status?: string }
  ) => {
    const res = await api.get(`/invoice-batches/${batchId}/line-items`, { params });
    return res as { data: IfiasLineItem[]; pagination: { total: number; page: number; pages: number } };
  },

  updateLineItem: async (
    batchId: number,
    lrId: number,
    body: Partial<Pick<IfiasLineItem, 'truck_type' | 'detention_days' | 'sat_slip_no' | 'processing_status' | 'remarks'>>
  ): Promise<IfiasLineItem> => {
    const res = await api.patch(`/invoice-batches/${batchId}/line-items/${lrId}`, body);
    return unwrap(res);
  },

  confirmAll: async (batchId: number): Promise<{ confirmed_count: number }> => {
    const res = await api.post(`/invoice-batches/${batchId}/confirm-all`);
    return unwrap(res);
  },

  exportBatch: async (batchId: number): Promise<Blob> => {
    const res = await api.post(`/invoice-batches/${batchId}/export`, {}, {
      responseType: 'blob',
    });
    return res as unknown as Blob;
  },

  reprocessLr: async (batchId: number, lrId: number) => {
    const res = await api.post(`/invoice-batches/${batchId}/reprocess/${lrId}`);
    return unwrap(res);
  },

  uploadExcel: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post(`/invoice-batches/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(res);
  },
};
