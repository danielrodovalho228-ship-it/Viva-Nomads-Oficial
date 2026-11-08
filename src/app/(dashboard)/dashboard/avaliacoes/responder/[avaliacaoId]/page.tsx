import { notFound, redirect } from "next/navigation";
import { PaginaResponder } from "@/components/avaliacoes/pagina-responder";
import { podeContestar, podeResponder } from "@/lib/avaliacoes-resposta";
import { hrefResponder } from "@/lib/avaliacoes-responder";
import { avaliacoesRecebidas } from "@/lib/data/avaliacoes-recebidas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Responder à avaliação", robots: { index: false } };

/**
 * E679 (PR 3) — "Responder à avaliação": só quem foi avaliado vê (a leitura é das avaliações PUBLICADAS sobre a pessoa
 * logada); de outra pessoa ou inexistente é 404. A regra de uma resposta é do banco e de podeResponder().
 */
export default async function ResponderAvaliacaoPage({ params }: { params: Promise<{ avaliacaoId: string }> }) {
  const { avaliacaoId } = await params;
  const res = await avaliacoesRecebidas({ exigir: true });
  if (!res) redirect(`/auth?next=${encodeURIComponent(hrefResponder(avaliacaoId))}`);
  const a = res.avaliacoes.find((x) => x.id === avaliacaoId);
  if (!a) notFound();
  const base = { alvoId: res.userId, status: "publicada" };
  return (
    <PaginaResponder
      a={{
        id: a.id,
        autorNome: a.autorNome,
        autorFotoUrl: a.autorFotoUrl,
        nota: a.nota,
        comentario: a.comentario,
        publicadaEm: a.publicadaEm,
        imovelTitulo: a.imovelTitulo,
        cidade: a.cidade,
        resposta: a.resposta,
        podeResponder: podeResponder({ ...base, jaRespondida: Boolean(a.resposta) }, res.userId),
        podeContestar: podeContestar({ ...base, contestacaoAberta: a.contestacaoAberta }, res.userId),
        contestacaoAberta: a.contestacaoAberta,
      }}
    />
  );
}
