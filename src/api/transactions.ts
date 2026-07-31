import { apiRequest } from "./client";
import type { Document } from "../types";

export interface CreateTransactionInput {
  bill_id: string;
  amount: string;
  payment_method?: string | null;
  reference_number?: string | null;
}

export function createTransaction(input: CreateTransactionInput): Promise<Document> {
  return apiRequest<Document>("/transactions", { method: "POST", body: input });
}

export function listTransactions(billId?: string): Promise<Document[]> {
  return apiRequest<Document[]>("/transactions", { query: { bill_id: billId } });
}

export function getTransaction(transactionId: string): Promise<Document> {
  return apiRequest<Document>(`/transactions/${transactionId}`);
}

export function cancelTransaction(transactionId: string, reason: string): Promise<Document> {
  return apiRequest<Document>(`/transactions/${transactionId}/cancel`, {
    method: "POST",
    body: { reason },
  });
}
