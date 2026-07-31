import { apiUpload, apiRequest } from "./client";
import type { Document, DocumentType } from "../types";

export interface UploadDocumentInput {
  targetDocumentType: Extract<DocumentType, "QUOTATION" | "BILL">;
  parentDocumentId: string;
  file: File;
  // Optional free-text hint for the extraction model (e.g. "line items
  // start on page 2"). The backend does the authoritative blank check
  // (trims and treats whitespace-only as not provided) — trimming here too
  // is just to avoid shipping a field that's obviously empty.
  prompt?: string;
}

// Multipart upload — file bytes can't travel as JSON. This mirrors the
// backend's own boundary: upload is a REST call, confirmation is a
// deliberate human action, and neither is a chat tool (see AGENTS.md §9).
export function uploadDocument(input: UploadDocumentInput): Promise<Document> {
  const form = new FormData();
  form.append("target_document_type", input.targetDocumentType);
  form.append("parent_document_id", input.parentDocumentId);
  form.append("file", input.file);
  if (input.prompt && input.prompt.trim()) {
    form.append("prompt", input.prompt.trim());
  }
  return apiUpload<Document>("/extraction/upload", form);
}

export interface ConfirmLineInput {
  ref_line_no: number;
  quantity: string;
  unit_price: string;
  tax_pct?: string;
}

export function confirmExtraction(documentId: string, lines: ConfirmLineInput[]): Promise<Document> {
  return apiRequest<Document>(`/extraction/${documentId}/confirm`, {
    method: "POST",
    body: { lines },
  });
}
