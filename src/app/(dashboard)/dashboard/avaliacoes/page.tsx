import { Star } from "lucide-react";
import { redirect } from "next/navigation";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { createClient } from "@/lib/supabase/server";
import { podeContestar, podeResponder } from "@/lib/avaliacoes-resposta";
import { numBR } from "@/lib/utils";
import { AcoesAvaliacao } from "./acoes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Avaliações recebidas" };

type Linha = { id: string; nota_geral: number; comentario_publico: string | null; publicada_em: string | null };

/** Avaliações PUBLICADAS sobre mim (RLS: só as minhas). Responder e pedir revisão ficam aqui. */
export default async function AvaliacoesRecebidasPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/auth");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/dashboard/avaliacoes");

  const { data } = await supabase
    .from("avaliacoes")
    .select("id, nota_geral, comentario_publico, publicada_em")
    .eq("alvo_id", user.id)
    .eq("status", "publicada")
    .order("publicada_em", { ascending: false });
  const avaliacoes = (data ?? []) as Linha[];
  const ids = avaliacoes.map((a) => a.id);

  const [{ data: resp }, { data: cont }] = ids.length
    ? await Promise.all([
        supabase.from("avaliacao_respostas").select("avaliacao_id, texto").in("avaliacao_id", ids),
        supabase.from("avaliacao_contestacoes").select("avaliacao_id, status").in("avaliacao_id", ids).eq("status", "aberta"),
      ])
    : [{ data: [] }, { data: [] }];
  const respostas = new Map(((resp ?? []) as { avaliacao_id: string; texto: string }[]).map((r) => [r.avaliacao_id, r.texto]));
  const abertas = new Set(((cont ?? []) as { avaliacao_id: string }[]).map((c) => c.avaliacao_id));

  return (
    <div className="w-full" data-testid="avaliacoes-recebidas">
      <PageTitle
        title="Avaliações recebidas"
        subtitle="Responda em público ou peça revisão quando houver ofensa, dado pessoal ou fato falso."
      />
      {avaliacoes.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Nenhuma avaliação publicada ainda"
          text="Quando uma estadia termina, as duas partes avaliam. A avaliação aparece aqui depois de publicada."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {avaliacoes.map((a) => {
            const resposta = respostas.get(a.id);
            const contestacaoAberta = abertas.has(a.id);
            const base = { alvoId: user.id, status: "publicada" };
            return (
              <Panel key={a.id} title={`Nota ${numBR(Number(a.nota_geral), 1)}`}>
                <div data-testid="avaliacao-recebida">
                  <p className="text-sm text-ink">{a.comentario_publico || "Sem comentário."}</p>
                  {resposta && (
                    <p className="mt-3 rounded-xl bg-sage-50 p-3 text-sm text-ink" data-testid="avaliacao-resposta">
                      <span className="block text-xs font-semibold text-forest">Sua resposta</span>
                      {resposta}
                    </p>
                  )}
                  {contestacaoAberta && (
                    <p className="mt-3 text-sm font-medium text-forest" data-testid="revisao-em-analise">
                      Pedido de revisão em análise pela equipe.
                    </p>
                  )}
                  <AcoesAvaliacao
                    avaliacaoId={a.id}
                    podeResponder={podeResponder({ ...base, jaRespondida: Boolean(resposta) }, user.id)}
                    podeRevisar={podeContestar({ ...base, contestacaoAberta }, user.id)}
                  />
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
