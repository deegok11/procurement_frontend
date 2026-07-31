import { apiRequest } from "./client";
import type { Document } from "../types";

export interface BilledLineInput {
  ref_line_no: number;
  quantity: string;
  unit_price: string;
  tax_pct?: string;
}

export interface CreateBillInput {
  grn_id: string;
  billed_lines: BilledLineInput[];
  invoice_number?: string | null;
  invoice_date?: string | null;
}

export function createBill(input: CreateBillInput): Promise<Document> {
  return apiRequest<Document>("/bills", { method: "POST", body: input });
}

export function listBills(grnId?: string): Promise<Document[]> {
  return apiRequest<Document[]>("/bills", { query: { grn_id: grnId } });
}

export function getBill(billId: string): Promise<Document> {
  return apiRequest<Document>(`/bills/${billId}`);
}

export function acknowledgeException(billId: string, notes = ""): Promise<Document> {
  return apiRequest<Document>(`/bills/${billId}/acknowledge-exception`, {
    method: "POST",
    body: { notes },
  });
}

export function cancelBill(billId: string, reason: string): Promise<Document> {
  return apiRequest<Document>(`/bills/${billId}/cancel`, { method: "POST", body: { reason } });
}
