import { dataBRT } from "@/lib/datas-brasilia";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Panel, StatCard, EmptyState } from "@/components/dashboard/primitives";
import { MOTIVOS_REVISAO, ehMotivoRevisao } from "@/lib/avaliacoes-resposta";
import { DecidirForm } from "./forms";

export const metadata = { title: "Avaliações — Admin" };

const dataBR = (iso: string) => dataBRT(iso);

/**
 * Admin → Avaliações: fila de pedidos de revisão. A avaliação só sai do ar por
 * regra objetiva (ofensa, dado pessoal, fato falso). O layout de /admin barra
 * quem não é admin; a RLS barra de novo no banco.
 */
export default async function AdminAvaliacoesPage() {
  const supabase = await createClient();
  if (!supabase) {
    return (
      <>
        <PageTitle title="Avaliações" />
        <EmptyState icon={Star} title="Modo demonstração" text="Sem conexão com o banco: nenhum dado real para mostrar." />
      </>
    );
  }
  const { data, error } = await supabase
    .from("avaliacao_contestacoes")
    .select("id, motivo, detalhe, status, decisao, criada_em, avaliacoes(nota_geral, comentario_publico)")
    .order("criada_em", { ascending: false })
    .limit(100);
  const lista = data ?? [];
  const abertas = lista.filter((c) => c.status === "aberta");

  return (
    <>
      <PageTitle title="Avaliações" subtitle="Pedidos de revisão feitos por quem foi avaliado." />
      {error && (
        <p role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Não foi possível ler os pedidos agora. Tente de novo em instantes.
        </p>
      )}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Pedidos abertos" value={abertas.length} icon={Star} />
        <StatCard label="Decididos" value={lista.length - abertas.length} icon={Star} />
      </div>
      <Panel title={`Pedidos de revisão (${lista.length})`}>
        {lista.length === 0 ? (
          <EmptyState icon={Star} title="Nenhum pedido ainda" text="Quando alguém pedir revisão de uma avaliação, aparece aqui." />
        ) : (
          <ul className="space-y-3">
            {lista.map((c) => {
              const av = (Array.isArray(c.avaliacoes) ? c.avaliacoes[0] : c.avaliacoes) as { nota_geral: number; comentario_publico: string | null } | null;
              return (
                <li key={c.id} className="rounded-xl border border-sage-200 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-ink">{ehMotivoRevisao(c.motivo) ? MOTIVOS_REVISAO[c.motivo] : c.motivo}</p>
                    <span className="rounded-full bg-sage-100 px-2 py-1 text-xs font-semibold text-forest">
                      {c.status === "aberta" ? "Aberto" : c.status === "removida" ? "Saiu do ar" : "Mantida"} · {dataBR(c.criada_em as string)}
                    </span>
                  </div>
                  {av && (
                    <p className="mt-2 text-muted">
                      Avaliação ({av.nota_geral}/5): {av.comentario_publico ? `“${av.comentario_publico}”` : "sem comentário"}
                    </p>
                  )}
                  <p className="mt-2 text-ink">Explicação: {c.detalhe}</p>
                  {c.status === "aberta" ? <DecidirForm id={c.id as string} /> : c.decisao && <p className="mt-2 text-muted">Decisão: {c.decisao}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
