import { apiRequest } from "./client";
import type { Document } from "../types";

export interface CreatePoInput {
  quotation_id: string;
  payment_terms?: string | null;
}

export function createPo(input: CreatePoInput): Promise<Document> {
  return apiRequest<Document>("/pos", { method: "POST", body: input });
}

export function listPos(quotationId?: string): Promise<Document[]> {
  return apiRequest<Document[]>("/pos", { query: { quotation_id: quotationId } });
}

export function getPo(poId: string): Promise<Document> {
  return apiRequest<Document>(`/pos/${poId}`);
}

export function cancelPo(poId: string, reason: string): Promise<Document> {
  return apiRequest<Document>(`/pos/${poId}/cancel`, { method: "POST", body: { reason } });
}
