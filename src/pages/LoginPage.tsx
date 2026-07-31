import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";
import { Button, ErrorBanner } from "../components/ui";

export function LoginPage() {
  const { user, login, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (user) {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? "/prs";
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(username, password);
      navigate("/prs", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed — is the API server running?");
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Procurement System</h1>
        <p className="mb-6 text-sm text-slate-500">Sign in to continue</p>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Username</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
          <input
            type="password"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <ErrorBanner message={error} />

        <Button type="submit" disabled={isLoading} className="mt-4 w-full">
          {isLoading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
