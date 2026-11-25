/*
  Prompt 50 — LEMBRETES honestos. PURO. Só há aviso quando há DECISÃO ou PRAZO real, com a ação no próprio aviso:
    • rascunho parado 3 dias → 1 e-mail "Faltam [N] passos para publicar [título]", botão para o passo exato, um por
      rascunho (nunca de novo);
    • pedido de moradia não enviado → nenhum aviso;
    • solicitação de parceiro sem resposta em 1 dia útil → alerta para o admin (o parceiro vê o estado e "Falar com a Viva");
    • verificação iniciada e não concluída em 24 h → 1 aviso com a causa da última tentativa;
    • chamado sem 1ª resposta dentro da promessa (24 h) → alerta no admin.
  Silêncio das 22h às 7h (Brasília): nada sai nesse horário; o que caiu nele espera as 7h.
  Roda: node --test src/lib/lembretes/regras.test.ts
*/
import { somarHorasUteis } from "../vistoria/laudo.ts";
import { PROMESSA_HUMANA_H } from "../../config/atendimento.ts";

const H = 3_600_000;

export { SILENCIO } from "../notifications/silencio.ts";
export const DIAS_RASCUNHO = 3;
export const HORAS_VERIFICACAO = 24;
/** A promessa pública a uma pessoa (PROMESSA_ATENDIMENTO, src/config/atendimento.ts). */
export const HORAS_PROMESSA_ATENDIMENTO = PROMESSA_HUMANA_H;


// Prompt 44: o silêncio (22h–7h) é a regra única de src/lib/notifications/silencio.ts.
export { emSilencio, proximoEnvioPermitido } from "../notifications/silencio.ts";

/** Rascunho parado há 3 dias (desde a última alteração)? O "1×" é a chave de envio (automacoes_envios). */
export function rascunhoParado(ultimaAlteracaoEm: string, agora: Date): boolean {
  return agora.getTime() - Date.parse(ultimaAlteracaoEm) >= DIAS_RASCUNHO * 24 * H;
}

/** "Falta 1 passo para publicar X" / "Faltam 3 passos para publicar X". */
export function textoRascunho(faltam: number, titulo: string): string {
  const t = titulo.trim() || "seu imóvel";
  return faltam === 1 ? `Falta 1 passo para publicar ${t}` : `Faltam ${faltam} passos para publicar ${t}`;
}

/** Solicitação de parceiro sem resposta da Viva depois de 1 dia útil (seg a sex, Brasília). */
export function parceiroSemResposta(criadaEm: string, decididaEm: string | null, agora: Date): boolean {
  return !decididaEm && agora > somarHorasUteis(new Date(criadaEm), 24);
}

/** Verificação iniciada (tentativa sem sucesso) e não concluída em 24 h. */
export function verificacaoParada(ultimaTentativa: { em: string; ok: boolean } | null, confirmada: boolean, agora: Date): boolean {
  if (!ultimaTentativa || ultimaTentativa.ok || confirmada) return false;
  return agora.getTime() - Date.parse(ultimaTentativa.em) >= HORAS_VERIFICACAO * H;
}

/** Chamado sem 1ª resposta de uma pessoa dentro da promessa pública (24 h). */
export function chamadoForaDaPromessa(c: { criadoEm: string; primeiraRespostaEm: string | null; resolvido: boolean }, agora: Date): boolean {
  if (c.primeiraRespostaEm || c.resolvido) return false;
  return agora.getTime() - Date.parse(c.criadoEm) > HORAS_PROMESSA_ATENDIMENTO * H;
}

export { ROTULO_ESTADO_CHAMADO, estadoDoChamado, type EstadoChamado } from "../atendimento/estado-chamado.ts";

/*
  E203 — lote das 08:00 (auditoria de e-mails 28/10). A conta real do Daniel recebeu 3 e-mails idênticos "Faltam N
  passos para publicar Studio com 2 quartos vem morar aqui": eram 3 RASCUNHOS diferentes com o mesmo título (a chave
  de envio por rascunho funcionou). Regra: no máximo 1 e-mail de rascunho por dono por dia — o rascunho mais recente
  vai no assunto e no botão; os demais entram numa linha "Você também tem…" e ficam marcados como avisados.
  O botão nomeia o PRÓXIMO passo como ação ("Preencher o endereço"), nunca o rótulo do item ("Endereço preenchido",
  que soa como já feito).
*/
const ACAO_DO_PASSO: Record<string, string> = {
  endereco: "Preencher o endereço",
  detalhes: "Informar banheiros e área",
  periodo: "Definir o período mínimo",
  fotos: "Enviar as fotos",
  titulo: "Escrever o título",
  descricao: "Escrever a descrição",
  preco: "Definir o preço mensal",
  garantia: "Escolher a garantia",
  documento: "Enviar o documento do imóvel",
  qualificacao: "Responder as declarações do imóvel",
  tipo_entrada: "Dizer como se entra no imóvel",
  internet: "Informar a velocidade da internet",
  sem_internet: "Informar a internet do imóvel",
  chacara: "Completar os dados da chácara",
  privacidade: "Confirmar a privacidade",
  conforto: "Confirmar o padrão mínimo",
  sublocacao: "Enviar a autorização",
  limite: "Liberar uma vaga no plano",
};

/** O próximo passo como AÇÃO (botão e lista do e-mail). Item sem verbo conhecido: "Completar: <rótulo>". */
export function acaoDoPasso(item: { key: string; label: string }): string {
  return ACAO_DO_PASSO[item.key] ?? `Completar: ${item.label}`;
}

/** Um rascunho por dono: o mais recente é o principal; os outros vão listados no mesmo e-mail. */
export function rascunhosPorDono<T extends { ownerId: string; criadoEm: string }>(lista: readonly T[]): { principal: T; outros: T[] }[] {
  const por = new Map<string, T[]>();
  for (const r of lista) por.set(r.ownerId, [...(por.get(r.ownerId) ?? []), r]);
  return [...por.values()].map((rs) => {
    const ord = [...rs].sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : a.criadoEm > b.criadoEm ? -1 : 0));
    return { principal: ord[0], outros: ord.slice(1) };
  });
}

/** "Você também tem 2 rascunhos parados: Studio …; Apto …." (sem outros, vazio). */
export function linhaOutrosRascunhos(titulos: readonly string[]): string {
  if (!titulos.length) return "";
  const lista = titulos.map((t) => t.trim() || "Rascunho de anúncio").join("; ");
  return titulos.length === 1 ? `Você também tem 1 rascunho parado: ${lista}.` : `Você também tem ${titulos.length} rascunhos parados: ${lista}.`;
}
