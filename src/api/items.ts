import { apiRequest } from "./client";
import type { ItemMaster } from "../types";

export interface CreateItemInput {
  item_code: string;
  description: string;
  uom: string;
  category?: string | null;
  reference_unit_price?: string | null;
}

export function createItem(input: CreateItemInput): Promise<ItemMaster> {
  return apiRequest<ItemMaster>("/items/add_item", { method: "POST", body: input });
}

export function listItems(isActive: boolean | undefined = true): Promise<ItemMaster[]> {
  return apiRequest<ItemMaster[]>("/items", { query: { is_active: isActive } });
}

export function getItem(itemId: string): Promise<ItemMaster> {
  return apiRequest<ItemMaster>(`/items/${itemId}`);
}

export function deactivateItem(itemId: string, reason: string): Promise<ItemMaster> {
  return apiRequest<ItemMaster>(`/items/${itemId}/deactivate`, {
    method: "POST",
    body: { reason },
  });
}
