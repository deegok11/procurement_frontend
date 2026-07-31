import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { itemsApi } from "../api";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, EmptyState, ErrorBanner, Field, SectionTitle, Spinner } from "../components/ui";
import { ReasonPrompt } from "../components/ReasonPrompt";
import type { ItemMaster } from "../types";

export function ItemsPage() {
  const { user } = useAuth();
  const canManage = user?.role === "requester" || user?.role === "approver";

  const [items, setItems] = useState<ItemMaster[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      setItems(await itemsApi.listItems()); // defaults to active-only
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load items");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleDeactivate(reason: string) {
    if (!deactivatingId) return;
    try {
      await itemsApi.deactivateItem(deactivatingId, reason);
      setDeactivatingId(null);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to deactivate item");
      setDeactivatingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {canManage && <CreateItemForm onCreated={refresh} />}

      <Card>
        <SectionTitle>Item Master</SectionTitle>
        <ErrorBanner message={error} />
        {items === null ? (
          <Spinner />
        ) : items.length === 0 ? (
          <EmptyState>No items yet.</EmptyState>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 font-medium">Code</th>
                <th className="py-2 font-medium">Description</th>
                <th className="py-2 font-medium">UOM</th>
                <th className="py-2 font-medium">Category</th>
                <th className="py-2 font-medium">Ref. price</th>
                {canManage && <th className="py-2 font-medium"></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.item_id} className="border-b border-slate-100">
                  <td className="py-2 font-mono text-xs">{item.item_code}</td>
                  <td className="py-2">{item.description}</td>
                  <td className="py-2">{item.uom}</td>
                  <td className="py-2 text-slate-500">{item.category ?? "—"}</td>
                  <td className="py-2 text-slate-500">{item.reference_unit_price ?? "—"}</td>
                  {canManage && (
                    <td className="py-2 text-right">
                      <Button variant="secondary" onClick={() => setDeactivatingId(item.item_id)}>
                        Deactivate
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {deactivatingId && (
        <ReasonPrompt
          label="Why is this item being deactivated?"
          onConfirm={handleDeactivate}
          onCancel={() => setDeactivatingId(null)}
        />
      )}
    </div>
  );
}

function CreateItemForm({ onCreated }: { onCreated: () => void }) {
  const [itemCode, setItemCode] = useState("");
  const [description, setDescription] = useState("");
  const [uom, setUom] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await itemsApi.createItem({
        item_code: itemCode,
        description,
        uom,
        category: category || null,
      });
      setItemCode("");
      setDescription("");
      setUom("");
      setCategory("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create item");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <SectionTitle>Add item</SectionTitle>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Item code">
          <input required value={itemCode} onChange={(e) => setItemCode(e.target.value)} className="input" />
        </Field>
        <Field label="Description" className="col-span-2">
          <input required value={description} onChange={(e) => setDescription(e.target.value)} className="input" />
        </Field>
        <Field label="UOM">
          <input required value={uom} onChange={(e) => setUom(e.target.value)} placeholder="EA" className="input" />
        </Field>
        <Field label="Category (optional)" className="col-span-2">
          <input value={category} onChange={(e) => setCategory(e.target.value)} className="input" />
        </Field>
        <div className="col-span-2 flex items-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding…" : "Add item"}
          </Button>
        </div>
      </form>
      <ErrorBanner message={error} />
    </Card>
  );
}
