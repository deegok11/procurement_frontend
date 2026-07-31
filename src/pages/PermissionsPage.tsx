import { useEffect, useState } from "react";
import { permissionsApi } from "../api";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Card, EmptyState, ErrorBanner, SectionTitle, Spinner } from "../components/ui";
import type { PermissionsMatrix } from "../api/permissions";

const ROLES = ["requester", "approver", "vendor", "super_admin"];

export function PermissionsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<PermissionsMatrix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      setData(await permissionsApi.getPermissionsMatrix());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load permissions");
    }
  }

  useEffect(() => {
    if (user?.role === "super_admin") refresh();
  }, [user?.role]);

  if (user?.role !== "super_admin") {
    return (
      <Card>
        <EmptyState>Only super admins can manage permissions.</EmptyState>
      </Card>
    );
  }

  async function toggle(role: string, permission: string, checked: boolean) {
    if (!data) return;
    const current = new Set(data.matrix[role] ?? []);
    if (checked) current.add(permission);
    else current.delete(permission);

    setError(null);
    setSavingRole(role);
    try {
      setData(await permissionsApi.updateRolePermissions(role, Array.from(current)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update permissions");
    } finally {
      setSavingRole(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Card>
        <SectionTitle>Permissions</SectionTitle>
        <p className="mb-3 text-xs text-slate-500">
          Toggle which permissions each role has. Changes save immediately and take effect on that
          role's very next request — no one needs to sign in again.
        </p>
        <ErrorBanner message={error} />
        {data === null ? (
          <Spinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4 font-medium">Permission</th>
                  {ROLES.map((role) => (
                    <th key={role} className="px-2 py-2 text-center font-medium capitalize">
                      {role.replace("_", " ")}
                      {savingRole === role && <span className="ml-1 text-slate-400">saving…</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.all_permissions.map((permission, i) => {
                  const prevGroup = data.all_permissions[i - 1]?.split(":")[0];
                  const group = permission.split(":")[0];
                  return (
                    <tr
                      key={permission}
                      className={`border-b border-slate-100 ${group !== prevGroup ? "border-t-2 border-t-slate-200" : ""}`}
                    >
                      <td className="py-1.5 pr-4 font-mono text-xs text-slate-700">{permission}</td>
                      {ROLES.map((role) => (
                        <td key={role} className="px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={data.matrix[role]?.includes(permission) ?? false}
                            disabled={savingRole !== null}
                            onChange={(e) => toggle(role, permission, e.target.checked)}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
