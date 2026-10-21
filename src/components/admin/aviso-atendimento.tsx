import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { chamadosEsperandoEquipe } from "@/lib/atendimento/escalonamento";
import { avisoTopoAdmin } from "@/lib/atendimento/aviso-topo-admin";

/** Linha vermelha no topo do /admin (ordem 7436a29a, item 5). O layout já exige admin; só conta chamados reais. */
export async function AvisoAtendimentoAdmin() {
  const admin = createAdminClient();
  if (!admin) return null;
  const [estourados, esperando] = await Promise.all([
    admin
      .from("chamados")
      .select("id", { count: "exact", head: true })
      .eq("simulacao", false)
      .eq("sla_estado", "estourado")
      .not("status", "in", "(resolvido,encerrado)")
      .then((r) => r.count ?? 0, () => 0),
    chamadosEsperandoEquipe(admin).then((l) => l.length, () => 0),
  ]);
  const aviso = avisoTopoAdmin({ estourados, semRespostaDaEquipe: esperando });
  if (!aviso) return null;
  return (
    <div role="alert" data-testid="aviso-atendimento-admin" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
      <span>{aviso.texto}</span>
      <Link href={aviso.href} className="inline-flex min-h-11 items-center underline">
        Abrir a fila
      </Link>
    </div>
  );
}
