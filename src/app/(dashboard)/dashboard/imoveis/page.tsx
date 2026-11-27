import { listMyProperties } from "@/lib/data/properties";
import { createClient } from "@/lib/supabase/server";
import { prontidaoDosImoveis } from "@/lib/anuncio/prontidao-servidor";
import type { Prontidao } from "@/lib/anuncio/prontidao";
import { meusPedidosDeAjuda } from "@/lib/data/ajuda-publicacao-actions";
import { donoPodeDecidir, ROTULO_STATUS } from "@/lib/ajuda-publicacao/ajuda";
import { DecisaoRascunho } from "@/components/property/decisao-rascunho";
import { MyPropertiesClient } from "./imoveis-client";
import { TEXTO_RASCUNHO_SALVO } from "@/components/layout/moldura-assistente";

/**
 * "Meus imóveis": o servidor busca a lista REAL do proprietário e a prontidão de
 * cada anúncio (fonte única: lib/anuncio/prontidao); a renderização fica no
 * client (imoveis-client), que suporta o modo demonstração do admin.
 */
export default async function MyPropertiesPage({ searchParams }: { searchParams: Promise<{ saiu?: string }> }) {
  // CADASTRO-MOLDURA: o "Sair" do assistente chega aqui com ?saiu=assistente e a linha do rascunho salvo.
  const saiuDoAssistente = (await searchParams).saiu === "assistente";
  // A lista e o usuário não dependem um do outro: busca os dois juntos (ordem 0f66a754, item 4).
  const [properties, supabase, ajudas] = await Promise.all([listMyProperties({ exigir: true }), createClient(), meusPedidosDeAjuda().catch(() => null)]);
  const prontidao: Record<string, Prontidao> = {};
  // 64-B: o motivo de cada pausa (decide se o dono vê "Reativar" ou o caminho da Viva).
  const pausas: Record<string, string | null> = {};
  if (supabase && properties.length) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const [mapa, { data: motivos }] = await Promise.all([
        // E498: rascunho conta a qualificação, como a barra do assistente e o Início.
        prontidaoDosImoveis(supabase, user.id, properties.map((p) => p.id), { qualificacaoDoRascunho: true }),
        supabase.from("properties").select("id, pausa_motivo").eq("owner_id", user.id).eq("status", "paused"),
      ]);
      // E508 (D-S2-04): anúncio publicado (no ar ou pausado) não carrega pendência de cadastro na lista — saiu a dica
      // "Informe o tipo de entrada" do topo e o link do cartão. O tipo segue obrigatório para publicar anúncio novo.
      for (const [id, pr] of mapa) prontidao[id] = pr;
      for (const m of (motivos ?? []) as { id: string; pausa_motivo: string | null }[]) pausas[m.id] = m.pausa_motivo;
    }
  }
  return (
    <>
      {saiuDoAssistente && (
        <p role="status" className="mb-4 rounded-xl border border-sage-200 bg-sage-100 px-4 py-3 text-sm text-forest" data-testid="rascunho-fica-salvo">
          {TEXTO_RASCUNHO_SALVO}
        </p>
      )}
      {/* Achado 55: falhou a leitura → aviso (o pedido pode ter uma decisão sua esperando), sem derrubar a lista. */}
      {ajudas === null && (
        <p role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-ink" data-testid="ajuda-andamento-falha">
          Não foi possível carregar o andamento dos seus pedidos de ajuda para publicar agora. Recarregue a página para tentar de novo.
        </p>
      )}
      {ajudas && ajudas.length > 0 && (
        <section className="mb-4 rounded-xl border border-sage-200 bg-sage-100 p-4 text-sm text-forest" data-testid="ajuda-andamento">
          <h2 className="font-medium text-ink">Publicamos para você</h2>
          <ul className="mt-1 space-y-1">
            {ajudas.map((a) => (
              <li key={a.id}>
                Pedido de {new Date(a.criado_em).toLocaleDateString("pt-BR")}: <strong>{ROTULO_STATUS[a.status]}</strong>
                {donoPodeDecidir(a.status) && <DecisaoRascunho id={a.id} />}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted">Nada vai ao ar sem a sua aprovação.</p>
        </section>
      )}
      <MyPropertiesClient properties={properties} prontidao={prontidao} pausas={pausas} />
    </>
  );
}
