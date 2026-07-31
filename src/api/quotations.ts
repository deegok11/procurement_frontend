import { apiRequest } from "./client";
import type { Document } from "../types";

export interface LineOfferInput {
  ref_line_no: number;
  quantity: string;
  unit_price: string;
  tax_pct?: string;
}

export interface SubmitQuotationInput {
  pr_id: string;
  line_offers: LineOfferInput[];
  currency?: string;
}

export function submitQuotation(input: SubmitQuotationInput): Promise<Document> {
  return apiRequest<Document>("/quotations", { method: "POST", body: input });
}

export function listQuotations(prId?: string): Promise<Document[]> {
  return apiRequest<Document[]>("/quotations", { query: { pr_id: prId } });
}

export function getQuotation(quotationId: string): Promise<Document> {
  return apiRequest<Document>(`/quotations/${quotationId}`);
}

export function withdrawQuotation(quotationId: string, reason: string): Promise<Document> {
  return apiRequest<Document>(`/quotations/${quotationId}/withdraw`, {
    method: "POST",
    body: { reason },
  });
}
