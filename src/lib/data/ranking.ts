import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { estadosIdentidade } from "@/lib/identidade/estado-servidor";
import { CHAVE_ORDEM_NOVA, gravarSombra, ordemNovaLigada } from "@/lib/ranking/chave";
import { sinaisDaLinha, type LinhaRankingSinais } from "@/lib/ranking/sinais";
import type { SinaisAnuncio } from "@/lib/ranking/ordem";

/*
  Servidor da ordem dos imóveis (Prompt 33, itens 4 e 5). Nunca importe em componente client:
  os sinais têm campos restritos (matrícula, CAF). O que sai daqui para a tela é nota, selo e motivo.
*/

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Sinais de vários anúncios: UMA chamada a ranking_sinais (0196) + a identidade dos donos em lote.
 * Ids que não são uuid (anúncios de exemplo) ficam fora — quem chama monta os de exemplo à parte.
 * Sem cliente de serviço ou sem a migração: lista vazia (a ordem antiga continua valendo).
 */
export async function sinaisDosAnuncios(ids: string[], admin: Admin | null = createAdminClient()): Promise<SinaisAnuncio[]> {
  const reais = [...new Set(ids.filter((id) => UUID.test(id)))];
  if (!admin || reais.length === 0) return [];
  const { data, error } = await admin.rpc("ranking_sinais", { p_ids: reais });
  if (error || !data) {
    if (error) console.error("[ranking_sinais]", error.code, error.message);
    return [];
  }
  const linhas = data as LinhaRankingSinais[];
  const identidades = await estadosIdentidade(admin, [...new Set(linhas.map((l) => l.dono_id))]);
  return linhas.map((l) => sinaisDaLinha(l, { identidadeConfirmada: identidades.get(l.dono_id)?.estado === "confirmada" }));
}

/** Interruptor do admin (null = ninguém mexeu; vale a variável de ambiente). */
export async function interruptorOrdemNova(admin: Admin | null = createAdminClient()): Promise<boolean | null> {
  if (!admin) return null;
  const { data, error } = await admin.from("plataforma_chaves").select("ligada").eq("chave", CHAVE_ORDEM_NOVA).maybeSingle();
  if (error || !data) return null;
  return (data as { ligada: boolean }).ligada === true;
}

/** A ordem nova vale agora? Desligada por padrão; o interruptor do admin vence o ambiente. */
export async function ordemNovaAtiva(admin: Admin | null = createAdminClient()): Promise<boolean> {
  return ordemNovaLigada(process.env.ORDEM_NOVA_ATIVA, await interruptorOrdemNova(admin));
}

export interface RegistroSombra {
  /** Filtros resumidos (cidade, faixa de valor, ordenação…). Nunca nome, e-mail, telefone ou id de pessoa. */
  busca: Record<string, string | number | boolean | null>;
  topAntigo: string[];
  topNovo: string[];
  donoDe: (id: string) => string | undefined;
}

const donosDistintos = (ids: string[], donoDe: (id: string) => string | undefined) =>
  new Set(ids.map((id) => donoDe(id) ?? id)).size;

/** Modo sombra: 1 em cada 5 buscas grava o top 10 antigo × novo (best-effort, nunca quebra a busca). */
export async function registrarSombra(r: RegistroSombra, admin: Admin | null = createAdminClient(), sorteio = Math.random()): Promise<boolean> {
  if (!admin || !gravarSombra(sorteio)) return false;
  const topAntigo = r.topAntigo.filter((id) => UUID.test(id)).slice(0, 10);
  const topNovo = r.topNovo.filter((id) => UUID.test(id)).slice(0, 10);
  const { error } = await admin.from("ranking_sombra").insert({
    busca: r.busca,
    top_antigo: topAntigo,
    top_novo: topNovo,
    donos_antigo: donosDistintos(topAntigo, r.donoDe),
    donos_novo: donosDistintos(topNovo, r.donoDe),
  });
  return !error;
}

/** Cron diário: apaga os registros da sombra com mais de 30 dias. */
export async function limparSombra(admin: Admin): Promise<number> {
  const { data, error } = await admin.rpc("limpar_ranking_sombra");
  return error ? 0 : Number(data) || 0;
}
