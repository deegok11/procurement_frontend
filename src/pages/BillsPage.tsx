import { useEffect, useState } from "react";
import { billsApi, grnsApi } from "../api";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ReasonPrompt } from "../components/ReasonPrompt";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, SectionTitle, Spinner } from "../components/ui";
import { ConfirmExtractionPanel, ExtractionStatusPanel } from "./QuotationsPage";
import type { Document } from "../types";

export function BillsPage() {
  const { user } = useAuth();
  const [bills, setBills] = useState<Document[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      setBills(await billsApi.listBills());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load bills");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // The LLM extraction pipeline runs in the background on the server — poll
  // while any row is still extracting-information so this list (and the
  // status shown on it) updates itself without a manual refresh. Those rows
  // aren't selectable (see below), so this is the only place status changes
  // for them get picked up.
  useEffect(() => {
    if (!bills?.some((b) => b.status === "EXTRACTING")) return;
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [bills]);

  const selected = bills?.find((b) => b.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {user?.role === "requester" && <CreateBillForm onCreated={refresh} />}
      <ErrorBanner message={error} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <SectionTitle>Bills</SectionTitle>
          {bills === null ? (
            <Spinner />
          ) : bills.length === 0 ? (
            <EmptyState>No bills yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {bills.map((b) =>
                b.status === "EXTRACTING" ? (
                  <li key={b.id}>
                    <div className="block w-full cursor-not-allowed px-2 py-2 text-left text-sm opacity-60">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800">{b.document_number ?? b.title}</span>
                        <Badge status={b.status} />
                      </div>
                      <div className="text-xs text-slate-500">{b.vendor_id}</div>
                    </div>
                  </li>
                ) : (
                  <li key={b.id}>
                    <button
                      onClick={() => setSelectedId(b.id)}
                      className={`block w-full px-2 py-2 text-left text-sm hover:bg-slate-50 ${selectedId === b.id ? "bg-slate-50" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800">{b.document_number ?? b.title}</span>
                        <Badge status={b.status} />
                      </div>
                      <div className="text-xs text-slate-500">
                        {b.vendor_id} — {b.amounts.grand_total} {b.currency}
                      </div>
                    </button>
                  </li>
                ),
              )}
            </ul>
          )}
        </Card>
        <div className="lg:col-span-3">
          {selected ? (
            <BillDetail key={selected.id} bill={selected} onChanged={refresh} />
          ) : (
            <Card>
              <EmptyState>Select a bill to see details.</EmptyState>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateBillForm({ onCreated }: { onCreated: () => void }) {
  const [recordedGrns, setRecordedGrns] = useState<Document[]>([]);
  const [selectedGrn, setSelectedGrn] = useState<Document | null>(null);
  const [billed, setBilled] = useState<Record<number, { quantity: string; unit_price: string; tax_pct: string }>>({});
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    grnsApi
      .listGrns()
      .then((grns) => setRecordedGrns(grns.filter((g) => g.status === "RECORDED")))
      .catch(() => {});
  }, []);

  async function selectGrn(grnId: string) {
    if (!grnId) {
      setSelectedGrn(null);
      return;
    }
    try {
      const grn = await grnsApi.getGrn(grnId);
      setSelectedGrn(grn);
      setBilled(
        Object.fromEntries(
          grn.line_items.map((li) => [li.line_no, { quantity: li.quantity, unit_price: li.unit_price ?? "", tax_pct: li.tax_pct ?? "0" }]),
        ),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load GRN");
    }
  }

  async function handleSubmit() {
    if (!selectedGrn) return;
    setError(null);
    setSubmitting(true);
    try {
      const billed_lines = selectedGrn.line_items.map((li) => ({
        ref_line_no: li.line_no,
        quantity: billed[li.line_no]?.quantity ?? li.quantity,
        unit_price: billed[li.line_no]?.unit_price ?? "0",
        tax_pct: billed[li.line_no]?.tax_pct ?? "0",
      }));
      await billsApi.createBill({
        grn_id: selectedGrn.id,
        billed_lines,
        invoice_number: invoiceNumber || null,
        invoice_date: invoiceDate || null,
      });
      setSelectedGrn(null);
      setInvoiceNumber("");
      setInvoiceDate("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create bill");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <SectionTitle>Enter a bill against a goods receipt</SectionTitle>
      {recordedGrns.length === 0 ? (
        <EmptyState>No recorded GRN/SRNs available to bill against.</EmptyState>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="GRN/SRN" className="sm:col-span-1">
              <select value={selectedGrn?.id ?? ""} onChange={(e) => selectGrn(e.target.value)} className="input">
                <option value="">Select a GRN...</option>
                {recordedGrns.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.document_number ?? g.id} — {g.vendor_id}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Invoice number (optional)">
              <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="input" />
            </Field>
            <Field label="Invoice date (optional)">
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="input"
              />
            </Field>
          </div>

          {selectedGrn && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 font-medium">Description</th>
                  <th className="py-2 font-medium">Received qty</th>
                  <th className="py-2 font-medium">Billed qty</th>
                  <th className="py-2 font-medium">Unit price</th>
                  <th className="py-2 font-medium">Tax %</th>
                </tr>
              </thead>
              <tbody>
                {selectedGrn.line_items.map((li) => (
                  <tr key={li.line_no} className="border-b border-slate-100">
                    <td className="py-2">{li.description}</td>
                    <td className="py-2">{li.quantity}</td>
                    <td className="py-2">
                      <input
                        className="input max-w-[6rem]"
                        value={billed[li.line_no]?.quantity ?? ""}
                        onChange={(e) =>
                          setBilled((prev) => ({ ...prev, [li.line_no]: { ...prev[li.line_no], quantity: e.target.value } }))
                        }
                      />
                    </td>
                    <td className="py-2">
                      <input
                        className="input max-w-[7rem]"
                        value={billed[li.line_no]?.unit_price ?? ""}
                        onChange={(e) =>
                          setBilled((prev) => ({ ...prev, [li.line_no]: { ...prev[li.line_no], unit_price: e.target.value } }))
                        }
                      />
                    </td>
                    <td className="py-2">
                      <input
                        className="input max-w-[5rem]"
                        value={billed[li.line_no]?.tax_pct ?? "0"}
                        onChange={(e) =>
                          setBilled((prev) => ({ ...prev, [li.line_no]: { ...prev[li.line_no], tax_pct: e.target.value } }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {selectedGrn && (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit bill"}
            </Button>
          )}
        </div>
      )}
      <div className="mt-2">
        <ErrorBanner message={error} />
      </div>
    </Card>
  );
}

function BillDetail({ bill, onChanged }: { bill: Document; onChanged: () => void }) {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [acking, setAcking] = useState(false);
  const [ackNotes, setAckNotes] = useState("");

  const canCancel =
    (user?.role === "requester" || user?.role === "approver") &&
    ["MATCHED", "ACKNOWLEDGED", "MATCH_EXCEPTION"].includes(bill.status);
  const canAcknowledge = user?.role === "approver" && bill.status === "MATCH_EXCEPTION";

  async function handleCancel(reason: string) {
    setError(null);
    try {
      await billsApi.cancelBill(bill.id, reason);
      setCancelling(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to cancel bill");
      setCancelling(false);
    }
  }

  async function handleAcknowledge() {
    setError(null);
    setAcking(true);
    try {
      await billsApi.acknowledgeException(bill.id, ackNotes);
      setAckNotes("");
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to acknowledge exception");
    } finally {
      setAcking(false);
    }
  }

  const threeWayMatch = (bill.extra?.three_way_match as { line_no: number; ok: boolean; detail: string }[] | undefined) ?? [];

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{bill.document_number ?? bill.title}</h2>
          <p className="text-xs text-slate-500">
            {bill.vendor_id}
            {bill.extra?.invoice_number ? ` · Invoice: ${bill.extra.invoice_number}` : ""}
          </p>
        </div>
        <Badge status={bill.status} />
      </div>

      <ErrorBanner message={error} />

      {bill.status === "EXTRACTION_FAILED" ? (
        <ExtractionStatusPanel doc={bill} />
      ) : bill.status === "PENDING_REVIEW" ? (
        <ConfirmExtractionPanel doc={bill} onChanged={onChanged} />
      ) : (
        <>
          <table className="mb-3 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 font-medium">Description</th>
                <th className="py-2 font-medium">Qty</th>
                <th className="py-2 font-medium">Unit price</th>
                <th className="py-2 font-medium">Line total</th>
              </tr>
            </thead>
            <tbody>
              {bill.line_items.map((li) => (
                <tr key={li.line_no} className="border-b border-slate-100">
                  <td className="py-2">{li.description}</td>
                  <td className="py-2">{li.quantity}</td>
                  <td className="py-2">{li.unit_price ?? "—"}</td>
                  <td className="py-2">{li.line_total ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mb-3 text-sm font-semibold text-slate-800">
            Total: {bill.amounts.grand_total} {bill.currency}
          </p>

          {threeWayMatch.length > 0 && (
            <div className="mb-3 space-y-1 rounded-md bg-slate-50 p-3 text-xs">
              <p className="font-medium text-slate-600">3-way match</p>
              {threeWayMatch.map((r) => (
                <p key={r.line_no} className={r.ok ? "text-green-700" : "text-orange-800"}>
                  Line {r.line_no}: {r.ok ? "OK" : r.detail}
                </p>
              ))}
            </div>
          )}

          {canAcknowledge && (
            <div className="mb-3 space-y-2 rounded-md border border-orange-200 bg-orange-50 p-3">
              <p className="text-xs text-orange-900">This bill has a match exception and needs approver sign-off.</p>
              <input
                value={ackNotes}
                onChange={(e) => setAckNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="input"
              />
              <Button disabled={acking} onClick={handleAcknowledge}>
                {acking ? "Acknowledging…" : "Acknowledge exception"}
              </Button>
            </div>
          )}

          {canCancel && (
            <div className="flex gap-2 border-t border-slate-100 pt-3">
              <Button variant="danger" onClick={() => setCancelling(true)}>
                Cancel bill
              </Button>
            </div>
          )}
        </>
      )}

      {cancelling && (
        <ReasonPrompt
          label="Why is this bill being cancelled?"
          onConfirm={handleCancel}
          onCancel={() => setCancelling(false)}
        />
      )}
    </Card>
  );
}
