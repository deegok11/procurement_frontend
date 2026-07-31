import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-slate-900 text-white hover:bg-slate-700 disabled:bg-slate-300",
  secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-50",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  EXTRACTING: "bg-sky-100 text-sky-700",
  PENDING_REVIEW: "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-700",
  ISSUED: "bg-green-100 text-green-700",
  RECORDED: "bg-green-100 text-green-700",
  MATCHED: "bg-green-100 text-green-700",
  SELECTED: "bg-green-100 text-green-700",
  VERIFIED: "bg-green-100 text-green-700",
  ACKNOWLEDGED: "bg-teal-100 text-teal-700",
  MATCH_EXCEPTION: "bg-orange-100 text-orange-800",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-red-100 text-red-700",
  WITHDRAWN: "bg-red-100 text-red-700",
  EXTRACTION_FAILED: "bg-red-100 text-red-700",
};

// Human-friendly overrides for statuses whose internal value (used
// throughout the domain layer/state machine) isn't the label we want shown.
const STATUS_LABELS: Record<string, string> = {
  EXTRACTING: "extracting-information",
};

export function Badge({ status }: { status: string }) {
  const classes = STATUS_COLORS[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${classes}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-8 text-sm text-slate-500">Loading…</div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-lg font-semibold text-slate-800">{children}</h2>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-500">{children}</p>;
}

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
