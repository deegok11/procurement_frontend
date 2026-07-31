import { useEffect, useState } from "react";
import { billsApi, transactionsApi } from "../api";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ReasonPrompt } from "../components/ReasonPrompt";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, SectionTitle, Spinner } from "../components/ui";
import type { Document } from "../types";

export function TransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Document[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      setTransactions(await transactionsApi.listTransactions());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load transactions");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const selected = transactions?.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {user?.role === "approver" && <CreateTransactionForm onCreated={refresh} />}
      <ErrorBanner message={error} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <SectionTitle>Transactions</SectionTitle>
          {transactions === null ? (
            <Spinner />
          ) : transactions.length === 0 ? (
            <EmptyState>No payments recorded yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {transactions.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => setSelectedId(t.id)}
                    className={`block w-full px-2 py-2 text-left text-sm hover:bg-slate-50 ${selectedId === t.id ? "bg-slate-50" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-800">{t.document_number ?? t.title}</span>
                      <Badge status={t.status} />
                    </div>
                    <div className="text-xs text-slate-500">
                      {t.vendor_id} — {t.amounts.grand_total} {t.currency}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="lg:col-span-3">
          {selected ? (
            <TransactionDetail key={selected.id} txn={selected} onChanged={refresh} />
          ) : (
            <Card>
              <EmptyState>Select a transaction to see details.</EmptyState>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateTransactionForm({ onCreated }: { onCreated: () => void }) {
  const [payableBills, setPayableBills] = useState<Document[]>([]);
  const [billId, setBillId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    billsApi
      .listBills()
      .then((bills) => setPayableBills(bills.filter((b) => b.status === "MATCHED" || b.status === "ACKNOWLEDGED")))
      .catch(() => {});
  }, []);

  function selectBill(id: string) {
    setBillId(id);
    const bill = payableBills.find((b) => b.id === id);
    setAmount(bill ? bill.amounts.grand_total : "");
  }

  async function handleSubmit() {
    if (!billId || !amount) return;
    setError(null);
    setSubmitting(true);
    try {
      await transactionsApi.createTransaction({
        bill_id: billId,
        amount,
        payment_method: paymentMethod || null,
        reference_number: referenceNumber || null,
      });
      setBillId("");
      setAmount("");
      setPaymentMethod("");
      setReferenceNumber("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <SectionTitle>Record a payment</SectionTitle>
      {payableBills.length === 0 ? (
        <EmptyState>No matched or acknowledged bills available to pay.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="Bill">
            <select value={billId} onChange={(e) => selectBill(e.target.value)} className="input">
              <option value="">Select a bill...</option>
              {payableBills.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.document_number ?? b.id} — {b.amounts.grand_total} {b.currency}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount">
            <input value={amount} onChange={(e) => setAmount(e.target.value)} className="input" />
          </Field>
          <Field label="Payment method (optional)">
            <input
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              placeholder="Bank transfer"
              className="input"
            />
          </Field>
          <Field label="Reference number (optional)">
            <input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className="input" />
          </Field>
          <div className="sm:col-span-4">
            <Button onClick={handleSubmit} disabled={!billId || !amount || submitting}>
              {submitting ? "Recording…" : "Record payment"}
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

function TransactionDetail({ txn, onChanged }: { txn: Document; onChanged: () => void }) {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const canCancel = user?.role === "approver" && txn.status === "RECORDED";

  async function handleCancel(reason: string) {
    setError(null);
    try {
      await transactionsApi.cancelTransaction(txn.id, reason);
      setCancelling(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to cancel transaction");
      setCancelling(false);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{txn.document_number ?? txn.title}</h2>
          <p className="text-xs text-slate-500">{txn.vendor_id}</p>
        </div>
        <Badge status={txn.status} />
      </div>

      <ErrorBanner message={error} />

      <dl className="grid grid-cols-2 gap-y-2 text-sm">
        <dt className="text-slate-500">Amount</dt>
        <dd className="text-slate-800">
          {txn.amounts.grand_total} {txn.currency}
        </dd>
        <dt className="text-slate-500">Payment method</dt>
        <dd className="text-slate-800">{(txn.extra?.payment_method as string | null) ?? "—"}</dd>
        <dt className="text-slate-500">Reference number</dt>
        <dd className="text-slate-800">{(txn.extra?.reference_number as string | null) ?? "—"}</dd>
      </dl>

      {canCancel && (
        <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
          <Button variant="danger" onClick={() => setCancelling(true)}>
            Cancel transaction
          </Button>
        </div>
      )}

      {cancelling && (
        <ReasonPrompt
          label="Why is this transaction being cancelled?"
          onConfirm={handleCancel}
          onCancel={() => setCancelling(false)}
        />
      )}
    </Card>
  );
}
