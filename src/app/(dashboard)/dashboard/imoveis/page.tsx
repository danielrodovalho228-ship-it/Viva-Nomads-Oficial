import { listMyProperties } from "@/lib/data/properties";
import { createClient } from "@/lib/supabase/server";
import { prontidaoDosImoveis } from "@/lib/anuncio/prontidao-servidor";
import type { Prontidao } from "@/lib/anuncio/prontidao";
import { meusPedidosDeAjuda } from "@/lib/data/ajuda-publicacao-actions";
import { donoPodeDecidir, ROTULO_STATUS } from "@/lib/ajuda-publicacao/ajuda";
import { DecisaoRascunho } from "@/components/property/decisao-rascunho";
import { MyPropertiesClient } from "./imoveis-client";
import { avisoTipoEntradaNoPainel } from "@/lib/anuncio/chegada-e-pedido";
import Link from "next/link";
import { destinoPendencia } from "@/lib/anuncio/destino-pendencia";
import { ETAPA } from "@/lib/anuncio/etapas-ids";
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
  // 61-B: anúncio já publicado sem o tipo de entrada segue no ar, com o aviso aqui (sem bloqueio retroativo).
  const semTipoEntrada: { id: string; title: string; status: string }[] = [];
  if (supabase && properties.length) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const [mapa, { data: motivos }, entrada] = await Promise.all([
        prontidaoDosImoveis(supabase, user.id, properties.map((p) => p.id)),
        supabase.from("properties").select("id, pausa_motivo").eq("owner_id", user.id).eq("status", "paused"),
        // Sem a 0225, erro → nenhum aviso.
        supabase.from("properties").select("id, title, status, tipo_entrada").eq("owner_id", user.id).neq("status", "draft"),
      ]);
      for (const l of (entrada.error ? [] : (entrada.data ?? [])) as { id: string; title: string; status: string; tipo_entrada: string | null }[]) {
        if (avisoTipoEntradaNoPainel({ tipoEntrada: l.tipo_entrada, status: l.status })) semTipoEntrada.push({ id: l.id, title: l.title, status: l.status });
      }
      for (const [id, pr] of mapa) prontidao[id] = pr;
      for (const m of (motivos ?? []) as { id: string; pausa_motivo: string | null }[]) pausas[m.id] = m.pausa_motivo;
    }
  }
  return (
    <>
      {saiuDoAssistente && (
        <p role="status" className="mb-4 rounded-xl border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-forest" data-testid="rascunho-fica-salvo">
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
        <section className="mb-4 rounded-xl border border-sage-200 bg-sage-50 p-4 text-sm text-forest" data-testid="ajuda-andamento">
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
      {semTipoEntrada.length > 0 && (
        <section className="mb-4 rounded-xl border border-line bg-white p-4 text-sm text-ink" data-testid="aviso-tipo-entrada">
          <p>{avisoTipoEntradaNoPainel({ tipoEntrada: null, status: "active" })}</p>
          <ul className="mt-2 space-y-1">
            {semTipoEntrada.map((i) => (
              <li key={i.id}>
                <Link href={destinoPendencia(i, ETAPA.regras)} className="inline-flex min-h-[44px] items-center font-medium text-forest underline">
                  {i.title}: informar o tipo de entrada
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <MyPropertiesClient properties={properties} prontidao={prontidao} pausas={pausas} />
    </>
  );
}
