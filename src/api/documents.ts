import { apiRequest } from "./client";
import type { Document, DocumentType, EventRecord } from "../types";

export interface ListDocumentsFilters {
  document_type?: DocumentType;
  status?: string;
  vendor_id?: string;
  parent_document_id?: string;
  root_pr_id?: string;
}

export function listDocuments(filters: ListDocumentsFilters = {}): Promise<Document[]> {
  return apiRequest<Document[]>("/documents", { query: filters });
}

export function getDocument(documentId: string): Promise<Document> {
  return apiRequest<Document>(`/documents/${documentId}`);
}

export function getDocumentEvents(documentId: string): Promise<EventRecord[]> {
  return apiRequest<EventRecord[]>(`/documents/${documentId}/events`);
}
