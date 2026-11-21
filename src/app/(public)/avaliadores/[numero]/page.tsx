import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, FlaskConical } from "lucide-react";
import { createPublicClient } from "@/lib/supabase/public";
import { VISTORIA_ATIVA } from "@/lib/flags";
import { LINHA_PUBLICA_DESIGNACAO } from "@/lib/vistoria/telas-exibicao";
import { ROTULO_AVALIADOR_CREDENCIADO, ROTULO_AVALIADOR_EM_TESTE, SELO_AVALIADOR_SOCIO, TEXTO_AVALIADOR_DE_TESTE } from "@/lib/vistoria/regras";

export const dynamic = "force-dynamic";

type Publico = { numero_credenciado: string; nome_curto: string; cidade: string; avaliacoes_feitas: number; nota_conduta: number | string | null; teste: boolean };

async function avaliador(numero: string): Promise<Publico | null> {
  if (!/^[A-Z]{3}-\d{3,}$/.test(numero)) return null;
  const sb = createPublicClient();
  if (!sb) return null;
  const { data } = await sb.rpc("avaliadores_publicos");
  return ((data ?? []) as Publico[]).find((a) => a.numero_credenciado === numero) ?? null;
}

/** E1075: o perfil público do avaliador do piloto (registo mínimo da 0349), antes de o credenciamento existir. */
type Perfil = { numero: string; nome_publico: string; cidade: string; selo: string; avaliacoes_feitas: number; nota_conduta: number | string | null };

async function perfilPublico(numero: string): Promise<Perfil | null> {
  if (!/^[A-Z]{3}-\d{3,}$/.test(numero)) return null;
  const sb = createPublicClient();
  if (!sb) return null;
  const { data } = await sb.rpc("avaliador_perfil_publico", { p_numero: numero });
  return ((data ?? []) as Perfil[])[0] ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ numero: string }> }): Promise<Metadata> {
  const { numero } = await params;
  const n = decodeURIComponent(numero).toUpperCase();
  // E1075: o perfil público (sem credenciamento) não se apresenta como credenciado, nem no título.
  const titulo = !(await avaliador(n)) && (await perfilPublico(n)) ? `Avaliador nº ${n}` : `Avaliador credenciado nº ${numero}`;
  // Enquanto a chave estiver desligada, a página existe para a rede (QA, admin) mas não vai para busca nenhuma.
  return { title: titulo, robots: VISTORIA_ATIVA ? undefined : { index: false, follow: false } };
}

/**
 * Página pública do avaliador credenciado (62-B1; desenho do 62-A, Parte 1, item 2): nome curto, número de credenciado,
 * cidade, avaliações feitas e a nota de CONDUTA. Sem botão de contratar: "A Viva designa o avaliador. O proprietário não escolhe."
 */
export default async function AvaliadorPage({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params;
  const n = decodeURIComponent(numero).toUpperCase();
  const a = await avaliador(n);
  // E1075: sem credenciado com este número, o perfil público do piloto; sem nenhum dos dois, 404.
  const perfil = a ? null : await perfilPublico(n);
  if (!a && !perfil) notFound();
  if (!a) return <PerfilPublico perfil={perfil!} />;
  const nota = a.nota_conduta == null ? null : Number(a.nota_conduta);
  return (
    <div className="mx-auto max-w-2xl px-4 py-12" data-testid="avaliador-publico">
      {a.teste && (
        <p className="mb-4 inline-flex items-start gap-2 rounded-lg bg-sage-100 px-3 py-2 text-sm font-semibold text-ink" data-testid="avaliador-teste">
          <FlaskConical className="mt-1 h-4 w-4 shrink-0" aria-hidden /> {TEXTO_AVALIADOR_DE_TESTE}
        </p>
      )}
      <p className="text-sm text-muted" data-testid="avaliador-rotulo">{a.teste ? ROTULO_AVALIADOR_EM_TESTE : ROTULO_AVALIADOR_CREDENCIADO}</p>
      <h1 className="mt-1 font-title text-2xl font-semibold text-ink">{a.nome_curto}</h1>
      <p className="mt-2 text-sm text-ink" data-testid="avaliador-linha-designacao">{LINHA_PUBLICA_DESIGNACAO}</p>
      <dl className="mt-6 grid gap-4 rounded-xl border border-line bg-white p-6 text-sm sm:grid-cols-2">
        <div><dt className="text-muted">Número de credenciado</dt><dd className="mt-1 font-semibold text-ink" data-testid="avaliador-numero">{a.numero_credenciado}</dd></div>
        <div><dt className="text-muted">Cidade</dt><dd className="mt-1 text-ink" data-testid="avaliador-cidade">{a.cidade}</dd></div>
        <div><dt className="text-muted">Avaliações feitas</dt><dd className="mt-1 text-ink" data-testid="avaliador-feitas">{a.avaliacoes_feitas}</dd></div>
        <div><dt className="text-muted">Nota de conduta</dt><dd className="mt-1 text-ink" data-testid="avaliador-nota">{nota == null ? "Ainda sem avaliações de conduta" : `${nota.toLocaleString("pt-BR")} de 5`}</dd></div>
      </dl>
      <p className="mt-4 text-xs text-muted">A nota mede só a conduta na visita (pontualidade, cordialidade e cuidado com o imóvel), nunca o resultado da avaliação.</p>
    </div>
  );
}

/**
 * E1075 (ORDEM-DUET-355): o perfil público do avaliador do piloto. O mesmo desenho do cartão acima, com o selo no lugar
 * do rótulo e os estados vazios honestos (0 laudos, conduta ainda sem avaliações). Sem botão: a escolha pelo dono e os
 * pedidos continuam desligados.
 */
function PerfilPublico({ perfil }: { perfil: Perfil }) {
  const nota = perfil.nota_conduta == null ? null : Number(perfil.nota_conduta);
  return (
    <div className="mx-auto max-w-2xl px-4 py-12" data-testid="avaliador-perfil-publico">
      <p className="inline-flex items-center gap-2 rounded-full bg-sage-100 px-3 py-1 text-sm font-semibold text-forest" data-testid="avaliador-selo">
        <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden />
        {SELO_AVALIADOR_SOCIO}
      </p>
      <h1 className="mt-3 font-title text-2xl font-semibold text-ink" data-testid="avaliador-nome">{perfil.nome_publico}</h1>
      <dl className="mt-6 grid gap-4 rounded-xl border border-line bg-white p-6 text-sm sm:grid-cols-2">
        <div><dt className="text-muted">Número de avaliador</dt><dd className="mt-1 font-semibold text-ink" data-testid="avaliador-numero">{perfil.numero}</dd></div>
        <div><dt className="text-muted">Cidade</dt><dd className="mt-1 text-ink" data-testid="avaliador-cidade">{perfil.cidade}</dd></div>
        <div><dt className="text-muted">Avaliações feitas</dt><dd className="mt-1 text-ink" data-testid="avaliador-feitas">{perfil.avaliacoes_feitas}</dd></div>
        <div><dt className="text-muted">Nota de conduta</dt><dd className="mt-1 text-ink" data-testid="avaliador-nota">{nota == null ? "Ainda sem avaliações de conduta" : `${nota.toLocaleString("pt-BR")} de 5`}</dd></div>
      </dl>
      <p className="mt-4 text-xs text-muted">A nota mede só a conduta na visita (pontualidade, cordialidade e cuidado com o imóvel), nunca o resultado da avaliação.</p>
    </div>
  );
}
