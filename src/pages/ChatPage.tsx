import { useEffect, useRef, useState } from "react";
import { extractionApi, grnsApi, prsApi } from "../api";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useChat } from "../chat/ChatContext";
import { Button, Card, EmptyState, ErrorBanner, Field, SectionTitle, Spinner } from "../components/ui";
import type { Document, DocumentType } from "../types";

export function ChatPage() {
  const { user } = useAuth();
  const canUpload = user?.role === "vendor" || user?.role === "requester";

  return (
    <div className="mx-auto flex max-w-6xl items-start gap-4">
      <ChatPanel />
      {canUpload && <UploadPanel />}
    </div>
  );
}

function ChatPanel() {
  const { sessionId, messages, input, setInput, sending, error, ensureSession, sendMessage } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureSession();
  }, [ensureSession]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  return (
    <Card className="flex h-[75vh] flex-1 flex-col">
      <SectionTitle>Chat</SectionTitle>
      <div ref={scrollRef} className="mb-3 flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState>
            {sessionId ? "Ask about your PRs, quotations, or document statuses." : "Starting a chat session…"}
          </EmptyState>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                  m.role === "user" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))
        )}
        {sending && <div className="text-xs text-slate-400">Thinking…</div>}
      </div>

      <ErrorBanner message={error} />

      <div className="mt-2 flex gap-2">
        <input
          className="input"
          placeholder={sessionId ? "Type a message…" : "Waiting for session…"}
          value={input}
          disabled={!sessionId}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />
        <Button onClick={sendMessage} disabled={!sessionId || sending || !input.trim()}>
          Send
        </Button>
      </div>
    </Card>
  );
}

function UploadPanel() {
  const { user } = useAuth();
  const targetDocumentType: Extract<DocumentType, "QUOTATION" | "BILL"> =
    user?.role === "vendor" ? "QUOTATION" : "BILL";

  const [parents, setParents] = useState<Document[]>([]);
  const [parentId, setParentId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Document | null>(null);

  useEffect(() => {
    if (targetDocumentType === "QUOTATION") {
      // Same discoverability compromise as SubmitQuotationForm in
      // QuotationsPage.tsx: LoginResponse carries no vendor_id, so this can't
      // be filtered to "PRs this vendor was invited to" client-side. The
      // backend enforces the invitation check on upload regardless.
      prsApi.listPrs().then((prs) => setParents(prs.filter((p) => p.status === "APPROVED"))).catch(() => {});
    } else {
      grnsApi.listGrns().then((grns) => setParents(grns.filter((g) => g.status === "RECORDED"))).catch(() => {});
    }
  }, [targetDocumentType]);

  async function handleUpload() {
    if (!file || !parentId) return;
    setError(null);
    setUploading(true);
    setResult(null);
    try {
      const doc = await extractionApi.uploadDocument({
        targetDocumentType,
        parentDocumentId: parentId,
        file,
        prompt,
      });
      setResult(doc);
      setFile(null);
      setParentId("");
      setPrompt("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to upload document");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="w-80 shrink-0">
      <SectionTitle>Upload {targetDocumentType === "QUOTATION" ? "a quotation" : "a bill"} PDF</SectionTitle>
      <div className="space-y-3">
        <Field label={targetDocumentType === "QUOTATION" ? "PR to quote against" : "GRN/SRN to bill against"}>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="input">
            <option value="">Select...</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.document_number ?? p.id} — {p.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="PDF file">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1.5 file:text-sm"
          />
        </Field>
        <Field label="Extraction prompt (optional)">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. line items start on page 2…"
            rows={2}
            className="input resize-none"
          />
        </Field>
        <Button onClick={handleUpload} disabled={!file || !parentId || uploading}>
          {uploading ? "Uploading…" : "Upload"}
        </Button>
        <ErrorBanner message={error} />
        {result && (
          <div className="rounded-md bg-green-50 p-3 text-xs text-green-900">
            <p className="font-medium">Document uploaded successfully.</p>
            <p className="mt-1">
              Please see the {targetDocumentType === "QUOTATION" ? "Quotations" : "Bills"} section for status.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
