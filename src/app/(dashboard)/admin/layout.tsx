import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Guarda server-side da área de admin (defesa em profundidade do C1).
 *
 * O middleware já barra /admin para não-admin, mas validamos de novo aqui no
 * SERVIDOR — se o middleware for contornado, este layout ainda exige sessão +
 * papel admin (lido de `profiles`, fonte confiável). Em modo demonstração
 * (sem Supabase) não há sessão de servidor para checar, então o acesso segue
 * o comportamento de demo; no acesso real, não-admin é redirecionado.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin") redirect("/dashboard");
  }
  return <>{children}</>;
}
