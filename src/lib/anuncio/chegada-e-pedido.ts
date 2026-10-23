/*
  61-B — dados que faltavam da análise do Airbnb. PURO (client-safe):
   1. tipo de entrada (público): como se entra no imóvel, sem código, senha nem local do cofre — isso fica só nas
      instruções de chegada (imovel_instrucoes_chegada.como_entrar, restritas ao dono e liberadas ao morador D-7);
   2. mensagem do dono para quem vai pedir (≤ 500, contato mascarado ao salvar e ao exibir);
   3. "o que considerar antes de pedir" (barulho, obra, escada, área compartilhada, outro + texto ≤ 300): soma na nota
      de qualidade; vazio não bloqueia;
   4. convidar quem vai morar junto: até qtd_ocupantes − 1, só leitura.
  Roda: node --test src/lib/anuncio/chegada-e-pedido.test.ts
*/
import { guardContactInfo } from "../messages/contact-guard.ts";

// ── 1. Tipo de entrada ───────────────────────────────────────────────────────────────────────────────────────────────
export const TIPOS_ENTRADA = [
  { chave: "porteiro", rotulo: "Porteiro ou recepção" },
  { chave: "chave_com_proprietario", rotulo: "Chave entregue pelo proprietário" },
  { chave: "cofre_de_chaves", rotulo: "Cofre de chaves" },
  { chave: "fechadura_com_codigo", rotulo: "Fechadura com código" },
  { chave: "outro", rotulo: "Outro" },
] as const;
export type TipoEntrada = (typeof TIPOS_ENTRADA)[number]["chave"];

export function tipoEntradaValido(v: unknown): v is TipoEntrada {
  return typeof v === "string" && TIPOS_ENTRADA.some((t) => t.chave === v);
}

export function rotuloTipoEntrada(v: string | null | undefined): string | null {
  return TIPOS_ENTRADA.find((t) => t.chave === v)?.rotulo ?? null;
}

export const ROTULO_FALTA_TIPO_ENTRADA = "Tipo de entrada";
export const AVISO_SEM_TIPO_ENTRADA = "Informe o tipo de entrada do imóvel (porteiro, chave, cofre, fechadura com código). Quem pede quer saber como vai entrar.";
export const AJUDA_TIPO_ENTRADA = "Aparece no anúncio. Código, senha e onde fica o cofre vão nas instruções de chegada, que só o morador recebe, 7 dias antes da entrada.";

/**
 * Tipo de entrada obrigatório só para publicar anúncio NOVO. O anúncio já publicado sem o campo continua publicado
 * (sem bloqueio retroativo) e ganha o aviso no painel.
 */
export function tipoEntradaBloqueia(p: { tipoEntrada: string | null | undefined; jaPublicado: boolean }): boolean {
  return !p.jaPublicado && !tipoEntradaValido(p.tipoEntrada);
}
export function avisoTipoEntradaNoPainel(p: { tipoEntrada: string | null | undefined; status: string }): string | null {
  return p.status !== "draft" && !tipoEntradaValido(p.tipoEntrada) ? AVISO_SEM_TIPO_ENTRADA : null;
}

// ── 2. Mensagem do dono para quem vai pedir ──────────────────────────────────────────────────────────────────────────
export const LIMITE_MENSAGEM_PEDIDO = 500;
export type TextoValidado = { ok: true; valor: string | null; mascarou: boolean } | { ok: false; erro: string };

/** Ao salvar: até 500, contato direto mascarado (como no chat). Vazio = sem mensagem. */
export function validarMensagemParaPedido(bruto: string | null | undefined): TextoValidado {
  const t = (bruto ?? "").trim();
  if (!t) return { ok: true, valor: null, mascarou: false };
  if (t.length > LIMITE_MENSAGEM_PEDIDO) return { ok: false, erro: `A mensagem passou de ${LIMITE_MENSAGEM_PEDIDO} caracteres. Encurte para salvar.` };
  const g = guardContactInfo(t);
  return { ok: true, valor: g.text, mascarou: g.masked };
}

/** Ao exibir: mascara de novo (texto antigo ou gravado por outro caminho nunca mostra contato). */
export function mensagemParaExibir(gravada: string | null | undefined): string | null {
  const t = (gravada ?? "").trim();
  return t ? guardContactInfo(t).text : null;
}

// ── 3. O que considerar antes de pedir ───────────────────────────────────────────────────────────────────────────────
export const CONSIDERAR_OPCOES = [
  { chave: "barulho", rotulo: "Barulho" },
  { chave: "obra", rotulo: "Obra por perto" },
  { chave: "escada", rotulo: "Escada (sem elevador)" },
  { chave: "area_compartilhada", rotulo: "Área compartilhada" },
  { chave: "outro", rotulo: "Outro" },
] as const;
export type ConsiderarAntes = (typeof CONSIDERAR_OPCOES)[number]["chave"];
export const LIMITE_CONSIDERAR_TEXTO = 300;

export function validarConsiderar(itens: unknown, texto: string | null | undefined): { ok: true; itens: ConsiderarAntes[]; texto: string | null } | { ok: false; erro: string } {
  const lista = Array.isArray(itens) ? itens : [];
  const validos = [...new Set(lista.filter((i): i is ConsiderarAntes => CONSIDERAR_OPCOES.some((o) => o.chave === i)))];
  const t = (texto ?? "").trim();
  if (t.length > LIMITE_CONSIDERAR_TEXTO) return { ok: false, erro: `O texto passou de ${LIMITE_CONSIDERAR_TEXTO} caracteres.` };
  return { ok: true, itens: validos, texto: t ? guardContactInfo(t).text : null };
}

/** Preenchido (algum item ou texto) soma na nota de qualidade; vazio não bloqueia nada. */
export function considerarPreenchido(p: { itens?: readonly string[] | null; texto?: string | null }): boolean {
  return (p.itens?.length ?? 0) > 0 || !!p.texto?.trim();
}

/** Com "barulho" marcado, a tela mostra a classe de ruído declarada no 59.1 (separada desta lista). */
export function mostraClasseDeRuido(itens: readonly string[] | null | undefined): boolean {
  return (itens ?? []).includes("barulho");
}

// ── 4. Convidar quem vai morar junto ─────────────────────────────────────────────────────────────────────────────────
/** Até qtd_ocupantes − 1 convidados ativos (o próprio morador já é um dos ocupantes). */
export function limiteConvidados(qtdOcupantes: number | null | undefined): number {
  return Math.max(0, (Number(qtdOcupantes) || 1) - 1);
}

export function podeConvidar(p: { qtdOcupantes: number | null | undefined; ativos: number; email: string; jaConvidados: string[]; emailDoMorador: string | null }): { ok: true } | { ok: false; erro: string } {
  const email = p.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, erro: "Digite um e-mail válido." };
  if (p.emailDoMorador && email === p.emailDoMorador.trim().toLowerCase()) return { ok: false, erro: "Esse é o seu próprio e-mail." };
  if (p.jaConvidados.map((e) => e.toLowerCase()).includes(email)) return { ok: false, erro: "Essa pessoa já foi convidada." };
  const limite = limiteConvidados(p.qtdOcupantes);
  if (p.ativos >= limite) {
    return { ok: false, erro: limite === 0 ? "O contrato é para 1 pessoa: não há vaga para convidar." : `O contrato é para ${limite + 1} pessoas: você já convidou ${limite}.` };
  }
  return { ok: true };
}

/** O que o ocupante convidado vê (só leitura) — e, por exclusão, o que NUNCA vê. */
export const CONVIDADO_VE = ["datas", "endereco", "instrucoes_chegada_d7", "linha_do_tempo"] as const;
export const CONVIDADO_NUNCA_VE = ["valores", "contrato", "caucao", "documentos", "recibos", "conversa"] as const;

/** Prazo do inventário (58): o convite some 30 dias depois do fim da estadia. */
export const DIAS_APAGAR_CONVIDADO = 30;
export function convidadoVence(fimDaEstadia: string | null | undefined): Date | null {
  if (!fimDaEstadia) return null;
  const d = new Date(fimDaEstadia);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + DIAS_APAGAR_CONVIDADO * 86_400_000);
}

// ── Gravação (servidor) ──────────────────────────────────────────────────────────────────────────────────────────────
export interface EntradaChegadaEPedido {
  tipoEntrada?: unknown;
  mensagemParaPedido?: unknown;
  considerarAntes?: unknown;
  considerarAntesTexto?: unknown;
}

/** Entrada do formulário → colunas de properties. Campo ausente (undefined) não mexe; vazio limpa. */
export function colunasChegadaEPedido(e: EntradaChegadaEPedido): { ok: true; colunas: Record<string, unknown> } | { ok: false; erro: string } {
  const colunas: Record<string, unknown> = {};
  if (e.tipoEntrada !== undefined) {
    if (e.tipoEntrada === null || e.tipoEntrada === "") colunas.tipo_entrada = null;
    else if (tipoEntradaValido(e.tipoEntrada)) colunas.tipo_entrada = e.tipoEntrada;
    else return { ok: false, erro: "Escolha o tipo de entrada na lista." };
  }
  if (e.mensagemParaPedido !== undefined) {
    const m = validarMensagemParaPedido(typeof e.mensagemParaPedido === "string" ? e.mensagemParaPedido : null);
    if (!m.ok) return m;
    colunas.mensagem_para_pedido = m.valor;
  }
  if (e.considerarAntes !== undefined || e.considerarAntesTexto !== undefined) {
    const c = validarConsiderar(e.considerarAntes, typeof e.considerarAntesTexto === "string" ? e.considerarAntesTexto : null);
    if (!c.ok) return c;
    if (e.considerarAntes !== undefined) colunas.considerar_antes = c.itens;
    if (e.considerarAntesTexto !== undefined) colunas.considerar_antes_texto = c.texto;
  }
  return { ok: true, colunas };
}

/** Os campos do 61-B guardados no JSON do rascunho do assistente. */
export function chegadaDoRascunho(data: unknown): EntradaChegadaEPedido {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  return { tipoEntrada: d.tipoEntrada, mensagemParaPedido: d.mensagemParaPedido, considerarAntes: d.considerarAntes, considerarAntesTexto: d.considerarAntesTexto };
}

// ── Leitura (anúncio) ────────────────────────────────────────────────────────────────────────────────────────────────
export interface ChegadaEPedido {
  tipoEntrada: TipoEntrada | null;
  mensagemParaPedido: string | null;
  considerarAntes: ConsiderarAntes[];
  considerarAntesTexto: string | null;
}
export interface LinhaChegadaEPedido {
  tipo_entrada?: string | null;
  mensagem_para_pedido?: string | null;
  considerar_antes?: string[] | null;
  considerar_antes_texto?: string | null;
}

/** Linha do banco → anúncio. Sem a 0225 (linha nula): undefined, e as telas escondem o bloco. A mensagem sai mascarada. */
export function chegadaEPedidoDaLinha(l: LinhaChegadaEPedido | null): ChegadaEPedido | undefined {
  if (!l) return undefined;
  const c = validarConsiderar(l.considerar_antes ?? [], null);
  return {
    tipoEntrada: tipoEntradaValido(l.tipo_entrada) ? l.tipo_entrada : null,
    mensagemParaPedido: mensagemParaExibir(l.mensagem_para_pedido),
    considerarAntes: c.ok ? c.itens : [],
    considerarAntesTexto: l.considerar_antes_texto?.trim() ? guardContactInfo(l.considerar_antes_texto.trim()).text : null,
  };
}

export function rotuloConsiderar(chave: string): string {
  return CONSIDERAR_OPCOES.find((o) => o.chave === chave)?.rotulo ?? chave;
}
