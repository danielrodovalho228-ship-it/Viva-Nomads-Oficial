/*
  Assinatura eletrônica na plataforma (ordem 0fd301f0, F40) — regras PURAS e testáveis.
  O texto dos modelos de contrato NÃO é tocado aqui: a pessoa assina o RESUMO do contrato registrado
  (partes, imóvel, valor, prazo), sempre com a marca de minuta enquanto o parecer jurídico não sai.
*/
import { createHash } from "node:crypto";
import { MARCA_MINUTA } from "./contrato-etapas.ts";
import { limpezaDoResumo, linhaLimpezaResumo, type LimpezaEstadia } from "./anuncio/limpeza-estadia.ts";
import { linhasRegrasPets, linhaValorPetCandidatura, normalizarRegrasPets, type RegrasPets } from "./anuncio/pets-regras.ts";

export type PapelContrato = "proprietario" | "inquilino";

export function papelNoContrato(userId: string, tenantId: string, ownerId: string): PapelContrato | null {
  if (userId === tenantId) return "inquilino";
  if (userId === ownerId) return "proprietario";
  return null;
}

export interface DadosResumo {
  contratoId: string;
  imovel: string;
  aluguelMensal: number;
  prazoDias: number;
  ocupantes: number;
  criadoEm: string;
  /** Início do 1º bloco (AAAA-MM-DD), a data de início escolhida no Fechamento (F37). Sem ela a linha não aparece. */
  inicioEstadia?: string | null;
  /** Regras de pets do anúncio (ordem 022afabb item 5): entram no resumo, não no texto do modelo. */
  petsRegras?: RegrasPets | null;
  /** Pets da ficha do inquilino na candidatura: sem pet, a linha "Valor pet" não aparece. */
  qtdPetsCandidatura?: number;
  /** Pacote de limpeza durante a estadia (ordem 4c74ac38 item 3): a quantidade por mês entra no resumo. */
  limpezaEstadia?: LimpezaEstadia | null;
  /** Condomínio + contas fixas por mês (R$): entram no "Total por mês" quando há limpeza paga. */
  outrosCustosMes?: number;
  /** Contrato assinado antes da linha existir (sem `outrosCustosMes` congelado): sem "Total por mês", para o resumo assinado e o hash não mudarem. */
  semTotalMes?: boolean;
}

/** Linhas do resumo mostradas na tela e usadas no hash (mesma fonte: o que a pessoa lê é o que ela assina). */
function dataDoResumo(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

/** Total por mês do resumo: valor mensal + condomínio e contas fixas + limpeza paga. Só existe com limpeza paga. */
export function totalMensalDoResumo(d: Pick<DadosResumo, "aluguelMensal" | "outrosCustosMes" | "limpezaEstadia" | "semTotalMes">): number | null {
  if (d.semTotalMes) return null;
  const limpeza = d.limpezaEstadia?.valorMes ?? 0;
  if (limpeza <= 0) return null;
  const outros = d.outrosCustosMes && d.outrosCustosMes > 0 ? d.outrosCustosMes : 0;
  return Math.round((d.aluguelMensal + outros + limpeza) * 100) / 100;
}

export function resumoContrato(d: DadosResumo): string[] {
  const inicio = d.inicioEstadia ? dataDoResumo(d.inicioEstadia) : null;
  const valor = d.aluguelMensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const total = totalMensalDoResumo(d);
  const valorPet = linhaValorPetCandidatura(!!d.petsRegras, d.petsRegras, d.qtdPetsCandidatura ?? 0);
  return [
    MARCA_MINUTA,
    `Contrato ${d.contratoId}`,
    `Imóvel: ${d.imovel}`,
    `Valor mensal: ${valor}`,
    ...(inicio ? [`Início da estadia: ${inicio}`] : []),
    `Prazo total: ${d.prazoDias} dias`,
    `Ocupantes: ${d.ocupantes}`,
    ...(d.petsRegras ? [`Pets — ${linhasRegrasPets(d.petsRegras, { semValorPet: true }).join("; ")}`] : []),
    ...(valorPet ? [valorPet] : []),
    ...(d.limpezaEstadia ? [linhaLimpezaResumo(d.limpezaEstadia)] : []),
    ...(total != null ? [`Total por mês: ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`] : []),
    `Registrado em: ${d.criadoEm}`,
  ];
}

/**
 * Regras de pets que entram no resumo. Antes de qualquer assinatura valem as do anúncio (ao vivo);
 * a partir da primeira assinatura valem só as congeladas no contrato, para as duas partes assinarem o
 * mesmo texto/hash mesmo que o dono mude o anúncio depois. Contrato já assinado sem congelamento
 * (anterior a esta regra) fica sem a linha, como era quando assinou.
 */
export function petsRegrasDoResumo(d: {
  algumaAssinatura: boolean;
  vivas: unknown;
  congeladas: unknown;
}): RegrasPets | null {
  return normalizarRegrasPets(d.algumaAssinatura ? d.congeladas : d.vivas);
}

/** Pacote de limpeza do resumo: ao vivo antes da 1ª assinatura, congelado (dentro de pets_regras_congeladas) depois. */
export function limpezaDoContrato(d: { algumaAssinatura: boolean; viva: unknown; congeladas: unknown }): LimpezaEstadia | null {
  const c = d.congeladas && typeof d.congeladas === "object" ? (d.congeladas as Record<string, unknown>).limpezaEstadia : null;
  return limpezaDoResumo({ algumaAssinatura: d.algumaAssinatura, viva: d.viva, congelada: c });
}

/** Condomínio + contas fixas do resumo: ao vivo antes da 1ª assinatura, congelado depois (sem a chave = 0). */
export function outrosCustosDoContrato(d: { algumaAssinatura: boolean; vivo: unknown; congeladas: unknown }): number {
  const c = d.congeladas && typeof d.congeladas === "object" ? (d.congeladas as Record<string, unknown>).outrosCustosMes : null;
  const n = Number(d.algumaAssinatura ? c : d.vivo);
  return Number.isFinite(n) && n > 0 && n <= 1_000_000 ? n : 0;
}

/** Depois da 1ª assinatura a linha "Total por mês" só vale se o total foi congelado junto (chave `outrosCustosMes`). */
export function totalMesAplicavel(d: { algumaAssinatura: boolean; congeladas: unknown }): boolean {
  if (!d.algumaAssinatura) return true;
  return !!d.congeladas && typeof d.congeladas === "object" && "outrosCustosMes" in (d.congeladas as Record<string, unknown>);
}

export function hashResumo(linhas: string[]): string {
  return createHash("sha256").update(linhas.join("\n"), "utf8").digest("hex");
}

/**
 * Linhas que entram no hash de quem assina. A linha "Início da estadia" (F37) passou a fazer parte do
 * resumo depois que alguém já podia ter assinado sem ela; se a outra parte já assinou sem a linha,
 * esta assina o mesmo texto (sem a linha) para as duas partes terem o mesmo hash.
 */
export function linhasParaHash(linhas: string[], hashDaOutraParte: string | null): string[] {
  if (!hashDaOutraParte || hashResumo(linhas) === hashDaOutraParte) return linhas;
  const sem = linhas.filter((l) => !l.startsWith("Início da estadia:"));
  return hashResumo(sem) === hashDaOutraParte ? sem : linhas;
}

export function motivoNaoPodeAssinar(c: {
  status: string;
  papel: PapelContrato | null;
  assinadoEm: string | null;
  aceite: boolean;
}): string | null {
  if (!c.papel) return "Você não é parte deste contrato.";
  if (c.status !== "ativo") return "Este contrato não está mais aguardando assinatura.";
  if (c.assinadoEm) return "Você já assinou este contrato.";
  if (!c.aceite) return "Marque “Li e concordo” para assinar.";
  return null;
}

/** Texto do cartão: o que cada parte vê sobre as assinaturas. */
export function avisoAssinatura(papel: PapelContrato, a: { proprietario: string | null; inquilino: string | null }): string {
  const eu = papel === "inquilino" ? a.inquilino : a.proprietario;
  const outro = papel === "inquilino" ? a.proprietario : a.inquilino;
  if (eu && outro) return "As duas partes assinaram.";
  const nomeOutro = papel === "inquilino" ? "proprietário" : "inquilino";
  if (eu) return `Você já assinou — falta o ${nomeOutro} assinar.`;
  if (outro) return `O ${nomeOutro} já assinou — falta você assinar.`;
  return "Nenhuma assinatura ainda.";
}

/** Assunto do aviso à OUTRA parte depois que alguém assina: se ela já tinha assinado, o contrato está completo. */
export function assuntoAvisoOutraParte(outraJaAssinou: boolean): string {
  return outraJaAssinou
    ? "As duas partes assinaram o contrato"
    : "O outro lado assinou o contrato — falta a sua assinatura";
}

/** Mesma janela do servidor (migração 0089): contrato encerrado e até 14 dias depois. Nunca em contrato ativo. */
export function podeAvaliarLocacao(status: string, encerradoEm: string | null, agora = new Date()): boolean {
  if (!["concluido", "encerrado_sem_renovacao", "encerrado_em_acerto"].includes(status)) return false;
  if (!encerradoEm) return false;
  const fim = new Date(encerradoEm).getTime();
  return Number.isFinite(fim) && agora.getTime() <= fim + 14 * 24 * 3600 * 1000;
}
