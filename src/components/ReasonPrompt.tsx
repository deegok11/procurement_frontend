import { useState } from "react";
import { Button } from "./ui";

// Every cancel/reject/withdraw action on the backend requires a non-empty
// reason (P3: cancellation is a first-class transition with a reason
// attached, never a silent delete). This is the one shared UI for all of
// them — a lightweight inline prompt rather than a full modal library.
export function ReasonPrompt({
  label,
  onConfirm,
  onCancel,
}: {
  label: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-lg">
        <p className="mb-2 text-sm font-medium text-slate-800">{label}</p>
        <textarea
          autoFocus
          className="mb-3 w-full rounded-md border border-slate-300 p-2 text-sm"
          rows={3}
          placeholder="Reason (required)…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}
