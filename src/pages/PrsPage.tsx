import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { itemsApi, prsApi } from "../api";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ReasonPrompt } from "../components/ReasonPrompt";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, SectionTitle, Spinner } from "../components/ui";
import type { LineItemInput } from "../api/prs";
import type { Document, ItemMaster } from "../types";

export function PrsPage() {
  const { user } = useAuth();
  const [prs, setPrs] = useState<Document[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      setPrs(await prsApi.listPrs());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load PRs");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const selected = prs?.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {user?.role === "requester" && <CreatePrForm onCreated={refresh} />}
      <ErrorBanner message={error} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <SectionTitle>Requisitions</SectionTitle>
          {prs === null ? (
            <Spinner />
          ) : prs.length === 0 ? (
            <EmptyState>No PRs yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {prs.map((pr) => (
                <li key={pr.id}>
                  <button
                    onClick={() => setSelectedId(pr.id)}
                    className={`block w-full px-2 py-2 text-left text-sm hover:bg-slate-50 ${
                      selectedId === pr.id ? "bg-slate-50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-800">
                        {pr.document_number ?? pr.title}
                      </span>
                      <Badge status={pr.status} />
                    </div>
                    <div className="text-xs text-slate-500">
                      {pr.title} — {pr.amounts.grand_total} {pr.currency}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="lg:col-span-3">
          {selected ? (
            // key={selected.id} forces a fresh mount per PR selection, so
            // local state (comparison results, open prompts, in-flight
            // errors) never leaks across documents.
            <PrDetail key={selected.id} pr={selected} onChanged={refresh} />
          ) : (
            <Card>
              <EmptyState>Select a PR to see details.</EmptyState>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function CreatePrForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [neededByDate, setNeededByDate] = useState("");
  const [items, setItems] = useState<ItemMaster[]>([]);
  const [rows, setRows] = useState<LineItemInput[]>([
    { item_id: null, description: "", uom: "", quantity: "", unit_price: "", tax_pct: "0" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    itemsApi.listItems().then(setItems).catch(() => {});
  }, []);

  function updateRow(index: number, patch: Partial<LineItemInput>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { item_id: null, description: "", uom: "", quantity: "", unit_price: "", tax_pct: "0" },
    ]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function applyItemSelection(index: number, itemId: string) {
    const item = items.find((i) => i.item_id === itemId);
    updateRow(index, {
      item_id: itemId || null,
      description: item ? item.description : rows[index].description,
      uom: item ? item.uom : rows[index].uom,
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await prsApi.createPr({
        title,
        line_items: rows,
        needed_by_date: neededByDate || null,
      });
      setTitle("");
      setNeededByDate("");
      setRows([{ item_id: null, description: "", uom: "", quantity: "", unit_price: "", tax_pct: "0" }]);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create PR");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <SectionTitle>New requisition</SectionTitle>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Title">
            <input required className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Needed by (optional)">
            <input
              type="date"
              className="input"
              value={neededByDate}
              onChange={(e) => setNeededByDate(e.target.value)}
            />
          </Field>
        </div>

        <div className="space-y-2">
          <span className="block text-xs font-medium text-slate-600">Line items</span>
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-12 items-end gap-2">
              <div className="col-span-2">
                <select
                  className="input"
                  value={row.item_id ?? ""}
                  onChange={(e) => applyItemSelection(i, e.target.value)}
                >
                  <option value="">(free text)</option>
                  {items.map((item) => (
                    <option key={item.item_id} value={item.item_id}>
                      {item.item_code}
                    </option>
                  ))}
                </select>
              </div>
              <input
                required
                placeholder="Description"
                className="input col-span-3"
                value={row.description}
                onChange={(e) => updateRow(i, { description: e.target.value })}
              />
              <input
                required
                placeholder="UOM"
                className="input col-span-1"
                value={row.uom}
                onChange={(e) => updateRow(i, { uom: e.target.value })}
              />
              <input
                required
                placeholder="Qty"
                className="input col-span-2"
                value={row.quantity}
                onChange={(e) => updateRow(i, { quantity: e.target.value })}
              />
              <input
                required
                placeholder="Unit price"
                className="input col-span-2"
                value={row.unit_price}
                onChange={(e) => updateRow(i, { unit_price: e.target.value })}
              />
              <input
                placeholder="Tax %"
                className="input col-span-1"
                value={row.tax_pct}
                onChange={(e) => updateRow(i, { tax_pct: e.target.value })}
              />
              <Button
                type="button"
                variant="secondary"
                className="col-span-1"
                disabled={rows.length === 1}
                onClick={() => removeRow(i)}
              >
                ✕
              </Button>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={addRow}>
            + Add line
          </Button>
        </div>

        <ErrorBanner message={error} />
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create draft"}
        </Button>
      </form>
    </Card>
  );
}

function PrDetail({ pr, onChanged }: { pr: Document; onChanged: () => void }) {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [promptAction, setPromptAction] = useState<"cancel" | "reject" | null>(null);
  const [vendorIds, setVendorIds] = useState("");
  const [comparison, setComparison] = useState<Document[] | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleReasonConfirm(reason: string) {
    if (promptAction === "cancel") await run(() => prsApi.cancelPr(pr.id, reason));
    if (promptAction === "reject") await run(() => prsApi.rejectPr(pr.id, reason));
    setPromptAction(null);
  }

  async function handleCompare() {
    setError(null);
    try {
      setComparison(await prsApi.compareQuotations(pr.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load comparison");
    }
  }

  const invitedVendors = (pr.extra.invited_vendor_ids as string[] | undefined) ?? [];

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{pr.title}</h2>
          <p className="text-xs text-slate-500">
            {pr.document_number ?? "(unnumbered)"} · {pr.id}
          </p>
        </div>
        <Badge status={pr.status} />
      </div>

      <table className="mb-3 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-1 font-medium">Description</th>
            <th className="py-1 font-medium">UOM</th>
            <th className="py-1 font-medium">Qty</th>
            <th className="py-1 font-medium">Unit price</th>
            <th className="py-1 font-medium">Tax %</th>
            <th className="py-1 font-medium">Line total</th>
          </tr>
        </thead>
        <tbody>
          {pr.line_items.map((li) => (
            <tr key={li.line_no} className="border-b border-slate-100">
              <td className="py-1">{li.description}</td>
              <td className="py-1">{li.uom}</td>
              <td className="py-1">{li.quantity}</td>
              <td className="py-1">{li.unit_price}</td>
              <td className="py-1">{li.tax_pct}</td>
              <td className="py-1">{li.line_total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mb-3 text-sm font-medium text-slate-700">
        Total: {pr.amounts.grand_total} {pr.currency}
      </p>

      {invitedVendors.length > 0 && (
        <p className="mb-3 text-xs text-slate-500">Invited vendors: {invitedVendors.join(", ")}</p>
      )}

      <ErrorBanner message={error} />

      <div className="flex flex-wrap gap-2">
        {pr.status === "DRAFT" && (
          <Button disabled={busy} onClick={() => run(() => prsApi.submitPr(pr.id))}>
            Submit for approval
          </Button>
        )}
        {pr.status === "SUBMITTED" && user?.role === "approver" && (
          <>
            <Button disabled={busy} onClick={() => run(() => prsApi.approvePr(pr.id))}>
              Approve
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => setPromptAction("reject")}>
              Reject
            </Button>
          </>
        )}
        {pr.status === "APPROVED" && user?.role === "requester" && (
          <InviteVendorsForm
            value={vendorIds}
            onChange={setVendorIds}
            busy={busy}
            onSubmit={() =>
              run(() =>
                prsApi.inviteVendors(
                  pr.id,
                  vendorIds.split(",").map((v) => v.trim()).filter(Boolean),
                ),
              )
            }
          />
        )}
        {["DRAFT", "SUBMITTED", "APPROVED"].includes(pr.status) && (
          <Button variant="danger" disabled={busy} onClick={() => setPromptAction("cancel")}>
            Cancel PR
          </Button>
        )}
        <Button variant="secondary" onClick={handleCompare}>
          Compare quotations
        </Button>
      </div>

      {comparison && (
        <div className="mt-4 border-t border-slate-200 pt-3">
          <p className="mb-2 text-sm font-medium text-slate-700">Quotations (cheapest first)</p>
          {comparison.length === 0 ? (
            <EmptyState>No comparable quotations yet.</EmptyState>
          ) : (
            <ul className="space-y-1 text-sm">
              {comparison.map((q) => (
                <li key={q.id} className="flex items-center justify-between rounded border border-slate-100 px-2 py-1">
                  <span>
                    {q.vendor_id} — {q.document_number ?? q.id}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge status={q.status} />
                    <span className="font-medium">
                      {q.amounts.grand_total} {q.currency}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {promptAction && (
        <ReasonPrompt
          label={promptAction === "cancel" ? "Why is this PR being cancelled?" : "Why is this PR being rejected?"}
          onConfirm={handleReasonConfirm}
          onCancel={() => setPromptAction(null)}
        />
      )}
    </Card>
  );
}

function InviteVendorsForm({
  value,
  onChange,
  onSubmit,
  busy,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        className="input w-56"
        placeholder="vnd_acme_001, vnd_globex_001"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <Button disabled={busy || !value.trim()} onClick={onSubmit}>
        Invite vendors
      </Button>
    </div>
  );
}
