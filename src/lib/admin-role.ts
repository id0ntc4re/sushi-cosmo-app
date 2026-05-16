import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AdminRole = "super_admin" | "admin" | null;
export type Branch = { id: string; name: string; address: string | null; phone: string | null; is_active: boolean; sort_order: number };

export function useAdminRole() {
  const [role, setRole] = useState<AdminRole>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setLoading(false); return; }
      const [{ data: roles }, { data: br }] = await Promise.all([
        supabase.from("user_roles").select("role,branch_id").eq("user_id", user.id),
        supabase.from("branches").select("*").order("sort_order"),
      ]);
      if (cancelled) return;
      const list = (roles ?? []) as { role: string; branch_id: string | null }[];
      const isSuper = list.some((r) => r.role === "super_admin");
      const adminRow = list.find((r) => r.role === "admin");
      setRole(isSuper ? "super_admin" : adminRow ? "admin" : null);
      setBranchId(isSuper ? null : (adminRow?.branch_id ?? null));
      setBranches((br ?? []) as Branch[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { role, branchId, branches, loading, isSuper: role === "super_admin", isAdmin: role !== null };
}

export function branchName(branches: Branch[], id: string | null | undefined): string {
  if (!id) return "—";
  return branches.find((b) => b.id === id)?.name ?? "—";
}
