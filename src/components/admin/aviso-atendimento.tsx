import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { chamadosEsperandoEquipe } from "@/lib/atendimento/escalonamento";
import { avisoTopoAdmin, MSG_ATRASO_NAO_LIDO } from "@/lib/atendimento/aviso-topo-admin";

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
      .then((r) => (r.error ? null : (r.count ?? 0)), () => null),
    chamadosEsperandoEquipe(admin, new Date(), { exigir: true }).then((l) => l.length, () => null),
  ]);
  // Achado 28: leitura que falhou não vira zero — o aviso diz que não deu para conferir.
  const aviso =
    estourados === null || esperando === null
      ? { texto: MSG_ATRASO_NAO_LIDO, href: "/admin/atendimento" }
      : avisoTopoAdmin({ estourados, semRespostaDaEquipe: esperando });
  if (!aviso) return null;
  return (
    <div role="alert" data-testid="aviso-atendimento-admin" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-red-700">
      <span>{aviso.texto}</span>
      <Link href={aviso.href} className="inline-flex min-h-11 items-center underline">
        Abrir a fila
      </Link>
    </div>
  );
}
