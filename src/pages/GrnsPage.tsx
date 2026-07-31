import { useEffect, useState } from "react";
import { grnsApi, posApi } from "../api";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ReasonPrompt } from "../components/ReasonPrompt";
import { Badge, Button, Card, EmptyState, ErrorBanner, SectionTitle, Spinner } from "../components/ui";
import type { Document } from "../types";

export function GrnsPage() {
  const { user } = useAuth();
  const [grns, setGrns] = useState<Document[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      setGrns(await grnsApi.listGrns());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load GRN/SRNs");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const selected = grns?.find((g) => g.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {user?.role === "requester" && <CreateGrnForm onCreated={refresh} />}
      <ErrorBanner message={error} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <SectionTitle>GRN / SRN</SectionTitle>
          {grns === null ? (
            <Spinner />
          ) : grns.length === 0 ? (
            <EmptyState>No goods receipts yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {grns.map((g) => (
                <li key={g.id}>
                  <button
                    onClick={() => setSelectedId(g.id)}
                    className={`block w-full px-2 py-2 text-left text-sm hover:bg-slate-50 ${selectedId === g.id ? "bg-slate-50" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-800">{g.document_number ?? g.title}</span>
                      <Badge status={g.status} />
                    </div>
                    <div className="text-xs text-slate-500">
                      {g.vendor_id} — {g.amounts.grand_total} {g.currency}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="lg:col-span-3">
          {selected ? (
            <GrnDetail key={selected.id} grn={selected} onChanged={refresh} />
          ) : (
            <Card>
              <EmptyState>Select a goods receipt to see details.</EmptyState>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateGrnForm({ onCreated }: { onCreated: () => void }) {
  const [issuedPos, setIssuedPos] = useState<Document[]>([]);
  const [selectedPo, setSelectedPo] = useState<Document | null>(null);
  const [receivedQty, setReceivedQty] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    posApi
      .listPos()
      .then((pos) => setIssuedPos(pos.filter((p) => p.status === "ISSUED")))
      .catch(() => {});
  }, []);

  async function selectPo(poId: string) {
    if (!poId) {
      setSelectedPo(null);
      return;
    }
    try {
      const po = await posApi.getPo(poId);
      setSelectedPo(po);
      setReceivedQty(Object.fromEntries(po.line_items.map((li) => [li.line_no, li.quantity])));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load PO");
    }
  }

  async function handleSubmit() {
    if (!selectedPo) return;
    setError(null);
    setSubmitting(true);
    try {
      const received_lines = selectedPo.line_items
        .filter((li) => (receivedQty[li.line_no] ?? "").trim() !== "")
        .map((li) => ({ ref_line_no: li.line_no, received_qty: receivedQty[li.line_no] }));
      await grnsApi.createGrn({ po_id: selectedPo.id, received_lines });
      setSelectedPo(null);
      setReceivedQty({});
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record goods receipt");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <SectionTitle>Record a goods receipt (GRN/SRN)</SectionTitle>
      {issuedPos.length === 0 ? (
        <EmptyState>No issued POs available to receive against.</EmptyState>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">PO</span>
            <select
              value={selectedPo?.id ?? ""}
              onChange={(e) => selectPo(e.target.value)}
              className="input max-w-md"
            >
              <option value="">Select a PO...</option>
              {issuedPos.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.document_number ?? po.id} — {po.vendor_id} — {po.amounts.grand_total} {po.currency}
                </option>
              ))}
            </select>
          </label>

          {selectedPo && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 font-medium">Description</th>
                  <th className="py-2 font-medium">Ordered qty</th>
                  <th className="py-2 font-medium">Received qty</th>
                </tr>
              </thead>
              <tbody>
                {selectedPo.line_items.map((li) => (
                  <tr key={li.line_no} className="border-b border-slate-100">
                    <td className="py-2">{li.description}</td>
                    <td className="py-2">{li.quantity}</td>
                    <td className="py-2">
                      <input
                        value={receivedQty[li.line_no] ?? ""}
                        onChange={(e) => setReceivedQty((prev) => ({ ...prev, [li.line_no]: e.target.value }))}
                        className="input max-w-[8rem]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {selectedPo && (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Recording…" : "Record receipt"}
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

function GrnDetail({ grn, onChanged }: { grn: Document; onChanged: () => void }) {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const canCancel = (user?.role === "requester" || user?.role === "approver") && grn.status === "RECORDED";

  async function handleCancel(reason: string) {
    setError(null);
    try {
      await grnsApi.cancelGrn(grn.id, reason);
      setCancelling(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to cancel GRN");
      setCancelling(false);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{grn.document_number ?? grn.title}</h2>
          <p className="text-xs text-slate-500">
            {grn.vendor_id}
            {grn.extra?.received_date ? ` · Received: ${grn.extra.received_date}` : ""}
          </p>
        </div>
        <Badge status={grn.status} />
      </div>

      <ErrorBanner message={error} />

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2 font-medium">Description</th>
            <th className="py-2 font-medium">Received qty</th>
            <th className="py-2 font-medium">Unit price</th>
            <th className="py-2 font-medium">Line total</th>
          </tr>
        </thead>
        <tbody>
          {grn.line_items.map((li) => (
            <tr key={li.line_no} className="border-b border-slate-100">
              <td className="py-2">{li.description}</td>
              <td className="py-2">{li.quantity}</td>
              <td className="py-2">{li.unit_price ?? "—"}</td>
              <td className="py-2">{li.line_total ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 text-right text-sm font-semibold text-slate-800">
        Total: {grn.amounts.grand_total} {grn.currency}
      </div>

      {canCancel && (
        <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
          <Button variant="danger" onClick={() => setCancelling(true)}>
            Cancel GRN
          </Button>
        </div>
      )}

      {cancelling && (
        <ReasonPrompt
          label="Why is this GRN being cancelled?"
          onConfirm={handleCancel}
          onCancel={() => setCancelling(false)}
        />
      )}
    </Card>
  );
}
