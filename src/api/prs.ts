import { apiRequest } from "./client";
import type { Document } from "../types";

export interface LineItemInput {
  item_id?: string | null;
  description: string;
  uom: string;
  quantity: string;
  unit_price: string;
  tax_pct?: string;
}

export interface CreatePrInput {
  title: string;
  line_items: LineItemInput[];
  currency?: string;
  needed_by_date?: string | null;
}

export function createPr(input: CreatePrInput): Promise<Document> {
  return apiRequest<Document>("/prs", { method: "POST", body: input });
}

export function listPrs(): Promise<Document[]> {
  return apiRequest<Document[]>("/prs");
}

export function getPr(prId: string): Promise<Document> {
  return apiRequest<Document>(`/prs/${prId}`);
}

export function submitPr(prId: string): Promise<Document> {
  return apiRequest<Document>(`/prs/${prId}/submit`, { method: "POST" });
}

export function approvePr(prId: string, notes = ""): Promise<Document> {
  return apiRequest<Document>(`/prs/${prId}/approve`, { method: "POST", body: { notes } });
}

export function rejectPr(prId: string, reason: string): Promise<Document> {
  return apiRequest<Document>(`/prs/${prId}/reject`, { method: "POST", body: { reason } });
}

export function cancelPr(prId: string, reason: string): Promise<Document> {
  return apiRequest<Document>(`/prs/${prId}/cancel`, { method: "POST", body: { reason } });
}

export function inviteVendors(prId: string, vendorIds: string[]): Promise<Document> {
  return apiRequest<Document>(`/prs/${prId}/invite-vendors`, {
    method: "POST",
    body: { vendor_ids: vendorIds },
  });
}

export function compareQuotations(prId: string): Promise<Document[]> {
  return apiRequest<Document[]>(`/prs/${prId}/compare-quotations`);
}
