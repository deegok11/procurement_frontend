import { useEffect, useState } from "react";
import { extractionApi, grnsApi, prsApi, quotationsApi } from "../api";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ReasonPrompt } from "../components/ReasonPrompt";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, SectionTitle, Spinner } from "../components/ui";
import type { LineOfferInput } from "../api/quotations";
import type { Document } from "../types";

export function QuotationsPage() {
  const { user } = useAuth();
  const [quotations, setQuotations] = useState<Document[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      setQuotations(await quotationsApi.listQuotations());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load quotations");
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
    if (!quotations?.some((q) => q.status === "EXTRACTING")) return;
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [quotations]);

  const selected = quotations?.find((q) => q.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {user?.role === "vendor" && <SubmitQuotationForm onSubmitted={refresh} />}
      <ErrorBanner message={error} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <SectionTitle>Quotations</SectionTitle>
          {quotations === null ? (
            <Spinner />
          ) : quotations.length === 0 ? (
            <EmptyState>No quotations yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {quotations.map((q) =>
                q.status === "EXTRACTING" ? (
                  <li key={q.id}>
                    <div className="block w-full cursor-not-allowed px-2 py-2 text-left text-sm opacity-60">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800">
                          {q.document_number ?? q.title}
                        </span>
                        <Badge status={q.status} />
                      </div>
                      <div className="text-xs text-slate-500">{q.vendor_id}</div>
                    </div>
                  </li>
                ) : (
                  <li key={q.id}>
                    <button
                      onClick={() => setSelectedId(q.id)}
                      className={`block w-full px-2 py-2 text-left text-sm hover:bg-slate-50 ${
                        selectedId === q.id ? "bg-slate-50" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800">
                          {q.document_number ?? q.title}
                        </span>
                        <Badge status={q.status} />
                      </div>
                      <div className="text-xs text-slate-500">
                        {q.vendor_id} — {q.amounts.grand_total} {q.currency}
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
            <QuotationDetail key={selected.id} quotation={selected} onChanged={refresh} />
          ) : (
            <Card>
              <EmptyState>Select a quotation to see details.</EmptyState>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function SubmitQuotationForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [invitablePrs, setInvitablePrs] = useState<Document[]>([]);
  const [selectedPr, setSelectedPr] = useState<Document | null>(null);
  const [offers, setOffers] = useState<Record<number, { quantity: string; unit_price: string; tax_pct: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Ideally this would filter to PRs where this vendor is actually
    // invited, but LoginResponse doesn't return the caller's own vendor_id
    // (see src/auth/AuthContext.tsx), so there's no client-side value to
    // filter against. Showing every APPROVED PR is a discoverability
    // compromise, not a security gap: the real invitation check runs
    // server-side in submit_quotation regardless of what this dropdown
    // offers — selecting a PR you weren't invited to just surfaces that
    // error cleanly on submit instead of hiding the option upfront.
    prsApi.listPrs().then((prs) => {
      setInvitablePrs(prs.filter((pr) => pr.status === "APPROVED"));
    }).catch(() => {});
  }, []);

  async function selectPr(prId: string) {
    if (!prId) {
      setSelectedPr(null);
      return;
    }
    try {
      const pr = await prsApi.getPr(prId);
      setSelectedPr(pr);
      setOffers(
        Object.fromEntries(pr.line_items.map((li) => [li.line_no, { quantity: li.quantity, unit_price: "", tax_pct: "0" }])),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load PR");
    }
  }

  async function handleSubmit() {
    if (!selectedPr) return;
    setError(null);
    setSubmitting(true);
    try {
      const line_offers: LineOfferInput[] = selectedPr.line_items.map((li) => ({
        ref_line_no: li.line_no,
        quantity: offers[li.line_no]?.quantity ?? li.quantity,
        unit_price: offers[li.line_no]?.unit_price ?? "0",
        tax_pct: offers[li.line_no]?.tax_pct ?? "0",
      }));
      await quotationsApi.submitQuotation({ pr_id: selectedPr.id, line_offers });
      setSelectedPr(null);
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit quotation");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <SectionTitle>Submit a quotation</SectionTitle>
      <Field label="PR you're invited to quote on" className="mb-3 max-w-md">
        <select className="input" value={selectedPr?.id ?? ""} onChange={(e) => selectPr(e.target.value)}>
          <option value="">Select a PR…</option>
          {invitablePrs.map((pr) => (
            <option key={pr.id} value={pr.id}>
              {pr.document_number ?? pr.title} — {pr.title}
            </option>
          ))}
        </select>
      </Field>

      {selectedPr && (
        <div className="space-y-2">
          {selectedPr.line_items.map((li) => (
            <div key={li.line_no} className="grid grid-cols-12 items-end gap-2">
              <span className="col-span-4 text-sm text-slate-700">{li.description}</span>
              <input
                className="input col-span-2"
                placeholder="Quantity"
                value={offers[li.line_no]?.quantity ?? ""}
                onChange={(e) =>
                  setOffers((prev) => ({ ...prev, [li.line_no]: { ...prev[li.line_no], quantity: e.target.value } }))
                }
              />
              <input
                className="input col-span-3"
                placeholder="Your unit price"
                value={offers[li.line_no]?.unit_price ?? ""}
                onChange={(e) =>
                  setOffers((prev) => ({ ...prev, [li.line_no]: { ...prev[li.line_no], unit_price: e.target.value } }))
                }
              />
              <input
                className="input col-span-2"
                placeholder="Tax %"
                value={offers[li.line_no]?.tax_pct ?? "0"}
                onChange={(e) =>
                  setOffers((prev) => ({ ...prev, [li.line_no]: { ...prev[li.line_no], tax_pct: e.target.value } }))
                }
              />
            </div>
          ))}
          <Button disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Submitting…" : "Submit quotation"}
          </Button>
        </div>
      )}
      <ErrorBanner message={error} />
    </Card>
  );
}

function QuotationDetail({ quotation, onChanged }: { quotation: Document; onChanged: () => void }) {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showWithdrawPrompt, setShowWithdrawPrompt] = useState(false);

  async function handleWithdraw(reason: string) {
    setError(null);
    setBusy(true);
    try {
      await quotationsApi.withdrawQuotation(quotation.id, reason);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to withdraw");
    } finally {
      setBusy(false);
      setShowWithdrawPrompt(false);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{quotation.title}</h2>
          <p className="text-xs text-slate-500">
            {quotation.document_number ?? "(unnumbered)"} · vendor {quotation.vendor_id}
          </p>
        </div>
        <Badge status={quotation.status} />
      </div>

      {quotation.status === "EXTRACTION_FAILED" ? (
        <ExtractionStatusPanel doc={quotation} />
      ) : quotation.status === "PENDING_REVIEW" ? (
        <ConfirmExtractionPanel doc={quotation} onChanged={onChanged} />
      ) : (
        <>
          <table className="mb-3 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-1 font-medium">Description</th>
                <th className="py-1 font-medium">Qty</th>
                <th className="py-1 font-medium">Unit price</th>
                <th className="py-1 font-medium">Line total</th>
              </tr>
            </thead>
            <tbody>
              {quotation.line_items.map((li) => (
                <tr key={li.line_no} className="border-b border-slate-100">
                  <td className="py-1">{li.description}</td>
                  <td className="py-1">{li.quantity}</td>
                  <td className="py-1">{li.unit_price}</td>
                  <td className="py-1">{li.line_total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mb-3 text-sm font-medium text-slate-700">
            Total: {quotation.amounts.grand_total} {quotation.currency}
          </p>

          <ErrorBanner message={error} />
          {quotation.status === "SUBMITTED" && user?.role === "vendor" && (
            <Button variant="danger" disabled={busy} onClick={() => setShowWithdrawPrompt(true)}>
              Withdraw
            </Button>
          )}
        </>
      )}

      {showWithdrawPrompt && (
        <ReasonPrompt
          label="Why is this quotation being withdrawn?"
          onConfirm={handleWithdraw}
          onCancel={() => setShowWithdrawPrompt(false)}
        />
      )}
    </Card>
  );
}

// Shared by QuotationsPage and BillsPage. Rows still extracting-information
// aren't selectable (see the list rendering above — the whole point is to
// keep the extraction pipeline's in-progress state out of the way, not
// clickable/editable), so by the time a document reaches this detail panel
// it's already past EXTRACTING — this only ever has EXTRACTION_FAILED to
// report.
export function ExtractionStatusPanel({ doc }: { doc: Document }) {
  if (doc.status === "EXTRACTION_FAILED") {
    const extractionError = (doc.extra?.extraction_error as string | undefined) ?? "Unknown error";
    return (
      <div className="rounded-md bg-red-50 p-3 text-sm text-red-900">
        <p className="font-medium">Extraction failed</p>
        <p className="mt-1 text-xs">{extractionError}</p>
        <p className="mt-1 text-xs text-red-700">Re-upload the PDF from the Chat tab to retry.</p>
      </div>
    );
  }
  return null;
}

// Shared by QuotationsPage and BillsPage — the extraction-confirm UX is
// identical in shape (show the AI's proposal + confidence, let a human
// requester map each proposed line to a ref_line_no on the parent and
// correct the values, submit as the authoritative confirmed lines). The only
// difference between the two callers is where the "parent" line items to map
// against come from — a QUOTATION's parent is a PR, a BILL's parent is a GRN.
export function ConfirmExtractionPanel({
  doc,
  onChanged,
}: {
  doc: Document;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [parentLines, setParentLines] = useState<Document["line_items"] | null>(null);
  const [rows, setRows] = useState<(LineOfferInput & { ref_line_no: number | "" })[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!doc.parent_document_id) return;
    const fetchParent = doc.document_type === "BILL" ? grnsApi.getGrn : prsApi.getPr;
    fetchParent(doc.parent_document_id).then((parent) => setParentLines(parent.line_items)).catch(() => {});
    setRows(
      doc.line_items.map((li) => ({
        ref_line_no: "",
        quantity: li.quantity,
        unit_price: li.unit_price ?? "",
        tax_pct: li.tax_pct ?? "0",
      })),
    );
  }, [doc]);

  async function handleConfirm() {
    setError(null);
    setSubmitting(true);
    try {
      const lines = rows
        .filter((r) => r.ref_line_no !== "")
        .map((r) => ({ ...r, ref_line_no: r.ref_line_no as number }));
      await extractionApi.confirmExtraction(doc.id, lines);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to confirm extraction");
    } finally {
      setSubmitting(false);
    }
  }

  const canConfirm = user?.role === "requester";
  const provenance = doc.extraction_provenance;
  const parentLabel = doc.document_type === "BILL" ? "GRN" : "PR";

  return (
    <div className="space-y-3">
      {provenance && (
        <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">
          <p className="mb-1 font-medium">AI-extracted, awaiting confirmation — model: {provenance.model || "unknown"}</p>
          {Object.keys(provenance.redaction_summary).length > 0 && (
            <p>
              PII redacted before extraction:{" "}
              {Object.entries(provenance.redaction_summary).map(([k, v]) => `${k}: ${v}`).join(", ")}
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-slate-500">
        AI-proposed line items below — map each to a {parentLabel} line and correct values before confirming.
        Nothing here is trusted until a requester confirms it.
      </p>
      <div className="space-y-2">
        {doc.line_items.map((li, i) => (
          <div key={li.line_no} className="rounded border border-slate-100 p-2">
            <p className="mb-1 text-xs text-slate-500">
              AI proposed: “{li.description}” — qty {li.quantity}, unit price {li.unit_price ?? "?"}
            </p>
            <div className="grid grid-cols-12 items-end gap-2">
              <select
                className="input col-span-4"
                value={rows[i]?.ref_line_no ?? ""}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, j) => (j === i ? { ...r, ref_line_no: e.target.value ? Number(e.target.value) : "" } : r)),
                  )
                }
              >
                <option value="">Map to {parentLabel} line…</option>
                {parentLines?.map((pl) => (
                  <option key={pl.line_no} value={pl.line_no}>
                    #{pl.line_no} {pl.description}
                  </option>
                ))}
              </select>
              <input
                className="input col-span-2"
                value={rows[i]?.quantity ?? ""}
                onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, quantity: e.target.value } : r)))}
              />
              <input
                className="input col-span-3"
                value={rows[i]?.unit_price ?? ""}
                onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, unit_price: e.target.value } : r)))}
              />
              <input
                className="input col-span-2"
                value={rows[i]?.tax_pct ?? "0"}
                onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, tax_pct: e.target.value } : r)))}
              />
            </div>
          </div>
        ))}
      </div>

      <ErrorBanner message={error} />
      {canConfirm ? (
        <Button disabled={submitting} onClick={handleConfirm}>
          {submitting ? "Confirming…" : "Confirm extraction"}
        </Button>
      ) : (
        <p className="text-xs text-slate-500">Only a requester can confirm an AI extraction.</p>
      )}
    </div>
  );
}
