import { Bot, Camera, Handshake, Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Panel, StatCard } from "@/components/dashboard/primitives";

/**
 * Áreas novas do admin na Visão geral (Caixa dos Sócios, Parceiros, Fotógrafos, Equipe), com números ao vivo.
 * Cada contagem falha sozinha (mostra "—") sem derrubar a página. O layout de /admin exige admin; a RLS confere.
 */
export async function AtalhosAdmin() {
  const supabase = await createClient();
  if (!supabase) return null;
  const contar = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
    try {
      const r = await q;
      return r.error ? "—" : (r.count ?? 0);
    } catch {
      return "—";
    }
  };
  const [caixa, interessados, fotografos, ordens] = await Promise.all([
    contar(supabase.from("caixa_socios").select("id", { count: "exact", head: true }).in("status", ["novo", "precisa_daniel"])),
    contar(supabase.from("parceiros_interesse").select("id", { count: "exact", head: true }).eq("status", "novo")),
    contar(supabase.from("fotografos").select("id", { count: "exact", head: true }).eq("aprovado", false)),
    contar(supabase.from("agentes_ordens").select("id", { count: "exact", head: true }).in("status", ["pendente", "lida"])),
  ]);
  return (
    <Panel title="Áreas do admin" className="mt-6">
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Caixa dos Sócios — a tratar" value={caixa} icon={Inbox} href="/admin/socios" />
        <StatCard label="Parceiros — novos interessados" value={interessados} icon={Handshake} href="/admin/parceiros" />
        <StatCard label="Fotógrafos em análise" value={fotografos} icon={Camera} href="/admin/fotografos" />
        <StatCard label="Equipe — ordens abertas" value={ordens} icon={Bot} href="/admin/agentes" />
      </div>
    </Panel>
  );
}
