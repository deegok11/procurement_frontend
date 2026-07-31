// Mirrors app/domain/schemas.py and app/domain/roles.py on the backend.
// Keep these in sync by hand — there's no shared schema generation (yet);
// see AGENTS.md "what's deferred until we scale" for the backend's own take
// on this kind of tradeoff.

export type Role = "requester" | "approver" | "vendor" | "super_admin";
export type Domain = "internal" | "vendor";

export type DocumentType =
  | "PR"
  | "QUOTATION"
  | "PO"
  | "GRN_SRN"
  | "BILL"
  | "TRANSACTION";

export interface LineItem {
  line_no: number;
  ref_line_no: number | null;
  item_id: string | null;
  description: string;
  uom: string;
  quantity: string;
  unit_price: string | null;
  line_total: string | null;
  tax_pct: string | null;
  extra: Record<string, unknown>;
}

export interface Amounts {
  subtotal: string;
  tax_total: string;
  grand_total: string;
}

export interface SoftDelete {
  is_deleted: boolean;
  reason: string | null;
  deleted_by: string | null;
  deleted_at: string | null;
}

export interface ExtractionField {
  field_name: string;
  value: string;
  confidence: number;
  page_number: number | null;
}

export interface ExtractionProvenance {
  source: string;
  model: string;
  request_id: string | null;
  fields: ExtractionField[];
  status: "PENDING_REVIEW" | "VERIFIED";
  reviewed_by: string | null;
  reviewed_at: string | null;
  redaction_summary: Record<string, number>;
}

export interface Document {
  id: string;
  document_type: DocumentType;
  document_number: string | null;
  series_code: string;
  financial_year: string | null;
  parent_document_id: string | null;
  root_pr_id: string | null;
  domain: Domain;
  vendor_id: string | null;
  status: string;
  requester_id: string;
  approver_id: string | null;
  title: string;
  currency: string;
  line_items: LineItem[];
  amounts: Amounts;
  extra: Record<string, unknown>;
  extraction_provenance: ExtractionProvenance | null;
  soft_delete: SoftDelete;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface ItemMaster {
  item_id: string;
  item_code: string;
  description: string;
  uom: string;
  category: string | null;
  reference_unit_price: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string;
}

export interface EventRecord {
  event_id: string;
  document_id: string | null;
  document_type: string | null;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor_user_id: string;
  actor_role: string;
  reason: string | null;
  diff: Record<string, unknown>;
  metadata: Record<string, unknown>;
  source: string;
  timestamp: string;
}

// Note: unlike the backend's own CurrentUser (which also carries user_id,
// vendor_id, approval_level — resolved server-side from the in-memory token
// store), LoginResponse is all the identity the frontend actually gets back.
// There's no vendor_id here, so the frontend can't (and doesn't need to)
// filter anything by vendor client-side — the backend already tenant-scopes
// every response by the bearer token. See src/auth/AuthContext.tsx for the
// AuthUser shape actually carried around the app (this + the typed-in username).
export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_at: string;
  role: Role;
  domain: Domain;
}
