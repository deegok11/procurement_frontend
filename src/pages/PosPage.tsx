import { useEffect, useState } from "react";
import { posApi, quotationsApi } from "../api";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ReasonPrompt } from "../components/ReasonPrompt";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, SectionTitle, Spinner } from "../components/ui";
import type { Document } from "../types";

export function PosPage() {
  const { user } = useAuth();
  const [pos, setPos] = useState<Document[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      setPos(await posApi.listPos());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load POs");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const selected = pos?.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {user?.role === "requester" && <CreatePoForm onCreated={refresh} />}
      <ErrorBanner message={error} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <SectionTitle>Purchase Orders</SectionTitle>
          {pos === null ? (
            <Spinner />
          ) : pos.length === 0 ? (
            <EmptyState>No purchase orders yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pos.map((po) => (
                <li key={po.id}>
                  <button
                    onClick={() => setSelectedId(po.id)}
                    className={`block w-full px-2 py-2 text-left text-sm hover:bg-slate-50 ${selectedId === po.id ? "bg-slate-50" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-800">{po.document_number ?? po.title}</span>
                      <Badge status={po.status} />
                    </div>
                    <div className="text-xs text-slate-500">
                      {po.vendor_id} — {po.amounts.grand_total} {po.currency}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="lg:col-span-3">
          {selected ? (
            <PoDetail key={selected.id} po={selected} onChanged={refresh} />
          ) : (
            <Card>
              <EmptyState>Select a purchase order to see details.</EmptyState>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function CreatePoForm({ onCreated }: { onCreated: () => void }) {
  const [submittedQuotations, setSubmittedQuotations] = useState<Document[]>([]);
  const [quotationId, setQuotationId] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    quotationsApi
      .listQuotations()
      .then((qs) => setSubmittedQuotations(qs.filter((q) => q.status === "SUBMITTED")))
      .catch(() => {});
  }, []);

  async function handleSubmit() {
    if (!quotationId) return;
    setError(null);
    setSubmitting(true);
    try {
      await posApi.createPo({ quotation_id: quotationId, payment_terms: paymentTerms || null });
      setQuotationId("");
      setPaymentTerms("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create PO");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <SectionTitle>Issue a PO from a submitted quotation</SectionTitle>
      {submittedQuotations.length === 0 ? (
        <EmptyState>No submitted quotations available to convert.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Quotation" className="sm:col-span-2">
            <select value={quotationId} onChange={(e) => setQuotationId(e.target.value)} className="input">
              <option value="">Select a quotation...</option>
              {submittedQuotations.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.document_number ?? q.id} — {q.vendor_id} — {q.amounts.grand_total} {q.currency}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Payment terms (optional)">
            <input
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              placeholder="Net 30"
              className="input"
            />
          </Field>
          <div className="flex items-end">
            <Button onClick={handleSubmit} disabled={!quotationId || submitting}>
              {submitting ? "Issuing…" : "Issue PO"}
            </Button>
          </div>
        </div>
      )}
      <div className="mt-2">
        <ErrorBanner message={error} />
      </div>
    </Card>
  );
}

function PoDetail({ po, onChanged }: { po: Document; onChanged: () => void }) {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const canCancel = (user?.role === "requester" || user?.role === "approver") && po.status === "ISSUED";

  async function handleCancel(reason: string) {
    setError(null);
    try {
      await posApi.cancelPo(po.id, reason);
      setCancelling(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to cancel PO");
      setCancelling(false);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{po.document_number ?? po.title}</h2>
          <p className="text-xs text-slate-500">
            {po.vendor_id} · {po.extra?.payment_terms ? `Terms: ${po.extra.payment_terms}` : "No payment terms set"}
          </p>
        </div>
        <Badge status={po.status} />
      </div>

      <ErrorBanner message={error} />

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2 font-medium">Description</th>
            <th className="py-2 font-medium">Qty</th>
            <th className="py-2 font-medium">Unit price</th>
            <th className="py-2 font-medium">Tax %</th>
            <th className="py-2 font-medium">Line total</th>
          </tr>
        </thead>
        <tbody>
          {po.line_items.map((li) => (
            <tr key={li.line_no} className="border-b border-slate-100">
              <td className="py-2">{li.description}</td>
              <td className="py-2">{li.quantity}</td>
              <td className="py-2">{li.unit_price ?? "—"}</td>
              <td className="py-2">{li.tax_pct ?? "0"}</td>
              <td className="py-2">{li.line_total ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 text-right text-sm font-semibold text-slate-800">
        Total: {po.amounts.grand_total} {po.currency}
      </div>

      {canCancel && (
        <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
          <Button variant="danger" onClick={() => setCancelling(true)}>
            Cancel PO
          </Button>
        </div>
      )}

      {cancelling && (
        <ReasonPrompt
          label="Why is this PO being cancelled?"
          onConfirm={handleCancel}
          onCancel={() => setCancelling(false)}
        />
      )}
    </Card>
  );
}
