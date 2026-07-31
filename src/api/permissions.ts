import { apiRequest } from "./client";

export interface PermissionsMatrix {
  matrix: Record<string, string[]>;
  all_permissions: string[];
}

export function getPermissionsMatrix(): Promise<PermissionsMatrix> {
  return apiRequest<PermissionsMatrix>("/permissions");
}

export function updateRolePermissions(role: string, permissions: string[]): Promise<PermissionsMatrix> {
  return apiRequest<PermissionsMatrix>(`/permissions/${role}`, {
    method: "PUT",
    body: { permissions },
  });
}
