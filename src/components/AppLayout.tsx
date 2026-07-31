import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button } from "./ui";
import type { Role } from "../types";

const TABS: { to: string; label: string; roles?: Role[] }[] = [
  { to: "/items", label: "Items" },
  { to: "/prs", label: "PRs" },
  { to: "/quotations", label: "Quotations" },
  { to: "/pos", label: "POs" },
  { to: "/grns", label: "GRN/SRN" },
  { to: "/bills", label: "Bills" },
  { to: "/transactions", label: "Transactions" },
  { to: "/chat", label: "Chat" },
  { to: "/permissions", label: "Permissions", roles: ["super_admin"] },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const tabs = TABS.filter((tab) => !tab.roles || (user && tab.roles.includes(user.role)));

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <span className="text-base font-semibold text-slate-900">Procurement System</span>
        {user && (
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>
              {user.username}{" "}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">
                {user.role.replace("_", " ")}
              </span>
            </span>
            <Button variant="secondary" onClick={logout}>
              Log out
            </Button>
          </div>
        )}
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
                isActive
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <main className="flex-1 overflow-y-auto bg-slate-50 p-4">
        <Outlet />
      </main>
    </div>
  );
}
