/*
  /admin "conversa com tudo" (Prompt 29): UMA fonte por indicador. Cada número que aparece em mais de um lugar
  (home, página da área, selo da barra lateral) sai de uma função daqui — puras, testáveis com node --test — e a
  tela mostra a fórmula (ícone "i") e a janela ("últimos 30 dias", "agora"). Contas is_teste ficam sempre fora
  (o filtro é feito na leitura: 0181 no banco, ehContaTeste/tipoImovel aqui).
*/

// ── Contratos: valor total, taxa e take rate (item 6) ─────────────────────────────────────────────────────────
export const DIAS_POR_MES_CONTRATO = 30;

export interface ContratoParaAgregado {
  aluguelMensal: number | null;
  prazoDias: number | null;
  /** Taxa GRAVADA no contrato (congelada no aceite). */
  taxaValor: number | null;
  taxaPercent: number | null;
}

/** Meses do contrato pelo prazo gravado (mesma regra do fechamento: prazo ÷ 30, arredondado). */
export function mesesDoContrato(prazoDias: number | null | undefined): number {
  const d = Number(prazoDias);
  if (!Number.isFinite(d) || d <= 0) return 0;
  return Math.max(1, Math.round(d / DIAS_POR_MES_CONTRATO));
}

/**
 * Contrato da regra anterior (taxa sobre 1 mês só): a taxa gravada bate com valor mensal × % e não com o total.
 * Ele entra no total pelo valor que foi de fato gravado e aparece marcado "regra anterior".
 */
export function ehRegraAnterior(c: ContratoParaAgregado): boolean {
  const meses = mesesDoContrato(c.prazoDias);
  const v = Number(c.aluguelMensal);
  const p = Number(c.taxaPercent);
  const t = Number(c.taxaValor);
  if (meses <= 1 || !(v > 0) || !(p > 0) || !(t > 0)) return false;
  const umMes = Math.round(v * p * 100) / 100;
  const total = Math.round(v * meses * p * 100) / 100;
  return Math.abs(t - umMes) < 0.01 && Math.abs(t - total) >= 0.01;
}

export interface AgregadoContratos {
  contratos: number;
  /** Σ valor mensal × meses (a mesma base da taxa: comissaoSobreContrato). */
  valorTotal: number;
  /** Σ das taxas GRAVADAS em cada contrato (nunca um % aplicado de novo sobre o total). */
  taxa: number;
  /** taxa ÷ valor total (null sem contrato). */
  takeRate: number | null;
  /** Σ valor mensal (informativo, "Valor mensal contratado (soma)"). */
  valorMensalSoma: number;
  regraAnterior: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function agregarContratos(linhas: ContratoParaAgregado[]): AgregadoContratos {
  let valorTotal = 0;
  let taxa = 0;
  let valorMensalSoma = 0;
  let regraAnterior = 0;
  for (const c of linhas) {
    const v = Number(c.aluguelMensal) > 0 ? Number(c.aluguelMensal) : 0;
    valorTotal += v * mesesDoContrato(c.prazoDias);
    valorMensalSoma += v;
    taxa += Number(c.taxaValor) > 0 ? Number(c.taxaValor) : 0;
    if (ehRegraAnterior(c)) regraAnterior++;
  }
  valorTotal = r2(valorTotal);
  taxa = r2(taxa);
  return { contratos: linhas.length, valorTotal, taxa, takeRate: valorTotal > 0 ? taxa / valorTotal : null, valorMensalSoma: r2(valorMensalSoma), regraAnterior };
}

export const FORMULA_VALOR_TOTAL = "Soma de valor mensal × meses de cada contrato do período (a mesma base da taxa de serviço).";
export const FORMULA_TAXA = "Soma das taxas gravadas em cada contrato no aceite (contratos da regra anterior entram pelo valor gravado).";
export const FORMULA_TAKE_RATE = "Taxa de serviço ÷ valor total dos contratos.";
export const FORMULA_VALOR_MENSAL = "Soma do valor mensal de cada contrato do período (informativo: não é o valor total).";

// ── Atendimento (item 7) ──────────────────────────────────────────────────────────────────────────────────────
/** Minutos abaixo de 1 h ("26 min"); acima, horas com 1 casa ("48,5 h"). Sem dado → "—". */
export function fmtTempoMin(min: number | null | undefined): string {
  if (min === null || min === undefined || !Number.isFinite(min)) return "—";
  if (min < 60) return `${Math.round(min)} min`;
  return `${(Math.round((min / 60) * 10) / 10).toLocaleString("pt-BR")} h`;
}

/** resolvidos = (resolvidos + encerrados) ÷ chamados do período; sem chamado → null. */
export function resolvidosAtendimento(m: { total: number; resolvidos: number; encerradosSemResolucao: number }): number | null {
  return m.total > 0 ? (m.resolvidos + m.encerradosSemResolucao) / m.total : null;
}

export const FORMULA_RESOLVIDOS_ATENDIMENTO = "(Chamados resolvidos + encerrados) ÷ chamados abertos no período. Simulações ficam fora.";
export const FORMULA_1A_RESPOSTA_ATENDIMENTO = "Média do tempo entre a abertura do chamado e a 1ª resposta da equipe (ou da Viva). Simulações ficam fora.";
export const FORMULA_CHAMADOS_ABERTOS = "Chamados de atendimento que ainda não foram resolvidos nem encerrados, agora (aberto, em andamento ou aguardando).";

// ── Pedidos (item 8) ──────────────────────────────────────────────────────────────────────────────────────────
export interface PedidoParaMetrica {
  criadoEm: string;
  /** 1ª resposta (contato ou proposta) recebida, se houver. */
  primeiraRespostaEm: string | null;
}

export function mediana(xs: number[]): number | null {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

export function respostaPedidos(pedidos: PedidoParaMetrica[]): { total: number; comResposta: number; taxa: number | null; medianaHoras: number | null } {
  const horas = pedidos
    .filter((p) => p.primeiraRespostaEm)
    .map((p) => (new Date(p.primeiraRespostaEm as string).getTime() - new Date(p.criadoEm).getTime()) / 3_600_000)
    .filter((h) => Number.isFinite(h) && h >= 0);
  const md = mediana(horas);
  return { total: pedidos.length, comResposta: horas.length, taxa: pedidos.length ? horas.length / pedidos.length : null, medianaHoras: md === null ? null : Math.round(md * 10) / 10 };
}

export const FORMULA_PEDIDOS_COM_RESPOSTA = "Pedidos do período que receberam pelo menos 1 contato ou proposta ÷ pedidos do período. Contas de teste ficam fora.";
export const FORMULA_TEMPO_1A_RESPOSTA_PEDIDO = "Mediana do tempo entre a publicação do pedido e o 1º contato ou proposta.";

// ── Documentos (item 9) ───────────────────────────────────────────────────────────────────────────────────────
export function textoFilaDocumentos(f: { documentos: number; matriculas: number }): string {
  const total = f.documentos + f.matriculas;
  const d = `${f.documentos} ${f.documentos === 1 ? "documento" : "documentos"}`;
  const m = `${f.matriculas} ${f.matriculas === 1 ? "matrícula" : "matrículas"}`;
  return `${total} na fila (${d} + ${m})`;
}
export const FORMULA_FILA_DOCUMENTOS = "Na fila agora = documentos de imóvel em revisão (um por imóvel e arquivo) + matrículas em revisão ainda não revisadas.";

// ── Agentes (item 10) ─────────────────────────────────────────────────────────────────────────────────────────
export const AGENTES_DEFINICOES = {
  aguardandoOk: { rotulo: "Aguardando o seu OK", formula: "Cartões de aprovação abertos (status pendente, ainda no prazo). É o único número do selo da barra lateral." },
  ordensPendentes: { rotulo: "Ordens pendentes", formula: "Ordens da equipe com status pendente (ainda não lidas pelo agente)." },
  ordensLidas: { rotulo: "Ordens lidas não concluídas", formula: "Ordens com status lida: o agente leu e ainda não concluiu." },
} as const;

// ── Imóveis: real × demonstração × teste (item 13) ───────────────────────────────────────────────────────────
export type TipoImovel = "real" | "demonstracao" | "teste";
const MARCA_TESTE = /^\s*\[\s*(teste|test|qa)\b[^\]]*\]/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function tipoImovel(p: { id: string; titulo: string | null; donoTeste?: boolean }): TipoImovel {
  if (!UUID.test(p.id)) return "demonstracao"; // os "Anúncio de exemplo" (ids ube-…) vêm do código, não do banco
  if (p.donoTeste || MARCA_TESTE.test(p.titulo ?? "")) return "teste";
  return "real";
}
export const ROTULO_TIPO_IMOVEL: Record<TipoImovel, string> = { real: "Real", demonstracao: "Demonstração", teste: "Teste" };

/** Aparece para o visitante: real ativo, ou demonstração com a vitrine de exemplos ligada. Teste nunca. */
export function apareceParaPublico(tipo: TipoImovel, status: string | null, demosLigadas: boolean): boolean {
  if (tipo === "teste") return false;
  if (tipo === "demonstracao") return demosLigadas;
  return status === "active";
}

// ── Janelas ───────────────────────────────────────────────────────────────────────────────────────────────────
export const JANELA_AGORA = "agora";
export const janelaDias = (dias: number) => `últimos ${dias} dias`;

// ── Listas de destino: o mesmo filtro da home (de/até/cidade) ────────────────────────────────────────────────
const DIA = /^\d{4}-\d{2}-\d{2}$/;
function diaValido(s: unknown): s is string {
  if (typeof s !== "string" || !DIA.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** de/até da URL (AAAA-MM-DD, inclusivos). Inválido ou ausente → null (a lista mostra tudo ou a janela padrão). */
export function periodoDaLista(sp: { de?: string | null; ate?: string | null }): { inicio: string; fim: string } | null {
  if (!diaValido(sp.de) || !diaValido(sp.ate) || sp.de > sp.ate) return null;
  return { inicio: sp.de, fim: sp.ate };
}

/** "Falta assinar: proprietário e inquilino" / "Assinado pelas duas partes". */
export function faltaAssinar(c: { assinadoDono: boolean; assinadoInquilino: boolean }): string {
  const falta = [!c.assinadoDono && "proprietário", !c.assinadoInquilino && "inquilino"].filter(Boolean) as string[];
  return falta.length ? `Falta assinar: ${falta.join(" e ")}` : "Assinado pelas duas partes";
}
