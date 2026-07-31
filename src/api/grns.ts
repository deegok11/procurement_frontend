import { apiRequest } from "./client";
import type { Document } from "../types";

export interface ReceivedLineInput {
  ref_line_no: number;
  received_qty: string;
}

export interface CreateGrnInput {
  po_id: string;
  received_lines: ReceivedLineInput[];
  received_date?: string | null;
}

export function createGrn(input: CreateGrnInput): Promise<Document> {
  return apiRequest<Document>("/grns", { method: "POST", body: input });
}

export function listGrns(poId?: string): Promise<Document[]> {
  return apiRequest<Document[]>("/grns", { query: { po_id: poId } });
}

export function getGrn(grnId: string): Promise<Document> {
  return apiRequest<Document>(`/grns/${grnId}`);
}

export function cancelGrn(grnId: string, reason: string): Promise<Document> {
  return apiRequest<Document>(`/grns/${grnId}/cancel`, { method: "POST", body: { reason } });
}
