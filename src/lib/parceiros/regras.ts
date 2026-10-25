/*
  Parceiros — regras do ciclo (Prompt 31a: funil, ativação, página, busca e textos). PURO (node --test).
  Conta única com papéis: o papel de parceiro é a tabela `parceiros` (profiles.role não muda). A conversa é pelas
  mensagens da Viva e a taxa de serviço é de 10%; quando houver pagamento pela plataforma, a divisão é na origem
  (90% direto ao parceiro, 10% direto à Viva) — a Viva não guarda dinheiro de ninguém. Sem node:crypto aqui (o
  formulário do navegador importa este arquivo); o token fica em token.ts.
*/
import { chaveCidade } from "../cidades.ts";
import { cnpjValido, cpfValido, soDigitos, type TipoPessoa } from "../documento-pessoa.ts";
import { emiteNotaParaGravar, faltaRespostaNota, passaFiltroNota, PENDENCIA_NOTA } from "./fiscal.ts";

// ── Categorias ─────────────────────────────────────────────────────────────────────────────────────────────────
export const CATEGORIAS_PARCEIRO = [
  { valor: "fotografia", rotulo: "Fotografia" },
  { valor: "mudanca", rotulo: "Mudança" },
  { valor: "limpeza", rotulo: "Limpeza" },
  { valor: "lavanderia", rotulo: "Lavanderia" },
  { valor: "montagem", rotulo: "Montagem de móveis" },
  { valor: "manutencao", rotulo: "Manutenção" },
  { valor: "outro", rotulo: "Outro serviço" },
  // Prompt 62-B1: avaliador credenciado. Só por credenciamento; nunca no catálogo "pedir serviço" (a Viva designa).
  { valor: "vistoria", rotulo: "Avaliação de imóveis" },
] as const;
export type CategoriaParceiro = (typeof CATEGORIAS_PARCEIRO)[number]["valor"];
/** Só pelo credenciamento de avaliadores (Prompt 62-B1): fora do catálogo, da busca e do "Seja parceiro". */
export const CATEGORIAS_SO_CREDENCIAMENTO: readonly string[] = ["vistoria"];
/** O catálogo "pedir serviço": as categorias que se contratam direto. */
export const CATEGORIAS_CATALOGO = CATEGORIAS_PARCEIRO.filter((x) => !CATEGORIAS_SO_CREDENCIAMENTO.includes(x.valor));
export const rotuloCategoria = (c: string) => CATEGORIAS_PARCEIRO.find((x) => x.valor === c)?.rotulo ?? "Serviço";
/** Categoria do catálogo (contratável). "vistoria" não entra: o avaliador nunca é escolhido nem contratado direto. */
export const categoriaValida = (c: string): c is CategoriaParceiro => CATEGORIAS_CATALOGO.some((x) => x.valor === c);

// ── Taxa de serviço (10%, todas as categorias; fotógrafos inclusive) ────────────────────────────────────────────
export const TAXA_SERVICO_PARCEIRO = 0.1;

/**
 * Valor do serviço → taxa da Viva (10%) e o que o parceiro recebe, em centavos inteiros. A taxa arredonda para 2 casas
 * com meio para cima, em conta inteira (sem erro de ponto flutuante): 10% de c centavos = floor((c + 5) / 10).
 */
export function dividirValor(valor: number): { taxa: number; parceiro: number } {
  const centavos = Math.round(Math.max(0, Number(valor) || 0) * 100);
  const taxa = Math.floor((centavos + 5) / 10);
  return { taxa: taxa / 100, parceiro: (centavos - taxa) / 100 };
}

// ── Textos públicos (item 8) ───────────────────────────────────────────────────────────────────────────────────
export const REGRAS_CLARAS = [
  "Você combina e agenda tudo pelas mensagens da Viva.",
  "Taxa de serviço: 10% sobre o valor do serviço, para todas as categorias. Você só paga quando há serviço contratado.",
  "Quando o pagamento pela plataforma estiver ativo, o valor é dividido na origem: 90% vai direto para você e 10% para a Viva. A Viva não guarda o seu dinheiro.",
] as const;
export const PAGAMENTO_EM_BREVE = "Pagamento pela plataforma em breve.";
export const CONTATO_APOS_ACEITE = "Contato e endereço do imóvel são liberados só depois do aceite, pelas mensagens da Viva.";

// ── Solicitação de parceria ────────────────────────────────────────────────────────────────────────────────────
export const CIDADES_MAX = 10;
export const DESCRICAO_MAX = 600;

export interface SolicitacaoEntrada {
  nome: string;
  tipoPessoa: string;
  documento: string;
  categorias: string[];
  cidades: string[];
  portfolioUrl?: string | null;
  descricao?: string | null;
  telefone?: string | null;
  empresa?: string | null;
  veiculo?: string | null;
  /** FISCAL-PARCEIRO-B: Sim/Não obrigatório na trilha PJ (MEI conta como PJ); PF não responde (grava null). */
  emiteNota?: unknown;
  aceite: boolean;
}

export interface SolicitacaoValida {
  nome: string;
  tipoPessoa: TipoPessoa;
  documento: string;
  categorias: CategoriaParceiro[];
  cidades: string[];
  portfolioUrl: string | null;
  descricao: string | null;
  telefone: string | null;
  dadosCategoria: { empresa?: string; veiculo?: string };
  emiteNota: boolean | null;
}

const limpar = (t: string | null | undefined, max: number) =>
  String(t ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/** Só https (ou http) com domínio; nada de javascript:, data: ou e-mail. */
export function urlPublicaValida(u: string | null | undefined): string | null {
  const t = String(u ?? "").trim();
  if (!t) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".") || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Validação do SERVIDOR (fonte da verdade). Campos por categoria: fotografia → portfólio; mudança → empresa e veículo; demais → descrição. */
export function validarSolicitacao(e: SolicitacaoEntrada): { ok: true; valor: SolicitacaoValida } | { ok: false; erro: string } {
  const nome = limpar(e.nome, 120);
  if (nome.length < 3) return { ok: false, erro: "Informe o seu nome (ou o da empresa)." };
  const tipo = e.tipoPessoa === "pj" ? "pj" : e.tipoPessoa === "pf" ? "pf" : null;
  if (!tipo) return { ok: false, erro: "Escolha pessoa física ou jurídica." };
  const doc = soDigitos(e.documento);
  if (tipo === "pf" ? !cpfValido(doc) : !cnpjValido(doc)) return { ok: false, erro: tipo === "pf" ? "CPF inválido: confira os números." : "CNPJ inválido: confira os números." };
  const categorias = [...new Set((e.categorias ?? []).filter(categoriaValida))];
  if (!categorias.length) return { ok: false, erro: "Escolha pelo menos uma categoria." };
  const vistas = new Set<string>();
  const cidades: string[] = [];
  for (const c of e.cidades ?? []) {
    const l = limpar(c, 80);
    const k = chaveCidade(l);
    if (!k || vistas.has(k)) continue;
    vistas.add(k);
    cidades.push(l);
  }
  if (!cidades.length) return { ok: false, erro: "Informe pelo menos uma cidade atendida." };
  if (cidades.length > CIDADES_MAX) return { ok: false, erro: `Até ${CIDADES_MAX} cidades.` };
  const portfolioBruto = String(e.portfolioUrl ?? "").trim();
  const portfolioUrl = urlPublicaValida(portfolioBruto);
  if (portfolioBruto && !portfolioUrl) return { ok: false, erro: "O link do portfólio precisa ser um endereço da web (https://…)." };
  const descricao = limpar(e.descricao, DESCRICAO_MAX) || null;
  const dados: { empresa?: string; veiculo?: string } = {};
  if (categorias.includes("fotografia") && !portfolioUrl) return { ok: false, erro: "Para fotografia, mande o link do seu portfólio." };
  if (categorias.includes("mudanca")) {
    const empresa = limpar(e.empresa, 120);
    const veiculo = limpar(e.veiculo, 120);
    if (!empresa || !veiculo) return { ok: false, erro: "Para mudança, informe a empresa e o veículo." };
    Object.assign(dados, { empresa, veiculo });
  }
  if (categorias.some((c) => c !== "fotografia" && c !== "mudanca") && !descricao) return { ok: false, erro: "Descreva o serviço que você oferece." };
  const tel = soDigitos(e.telefone);
  if (tel && (tel.length < 10 || tel.length > 13)) return { ok: false, erro: "Telefone inválido (com DDD)." };
  // Portão que BLOQUEIA: PJ sem Sim/Não não conclui o cadastro.
  const nota = emiteNotaParaGravar(tipo, e.emiteNota);
  if (!nota.ok) return nota;
  if (!e.aceite) return { ok: false, erro: "Confirme que a Viva pode usar estes dados para analisar a parceria." };
  return { ok: true, valor: { nome, tipoPessoa: tipo, documento: doc, categorias, cidades, portfolioUrl, descricao, telefone: tel || null, dadosCategoria: dados, emiteNota: nota.valor } };
}

// ── Token de ativação (7 dias, uso único; o banco guarda só o hash) ─────────────────────────────────────────────
export const DIAS_TOKEN = 7;
export type SituacaoToken = "valido" | "vencido" | "usado" | "invalido";
export function situacaoToken(s: { status: string; tokenExpiraEm: string | null } | null, agora: Date): SituacaoToken {
  if (!s) return "invalido";
  if (s.status === "ativada") return "usado";
  if (s.status !== "aprovada" && s.status !== "aguardando_email") return "invalido";
  if (!s.tokenExpiraEm || Date.parse(s.tokenExpiraEm) <= agora.getTime()) return "vencido";
  return "valido";
}
export function expiraToken(agora: Date): string {
  return new Date(agora.getTime() + DIAS_TOKEN * 86_400_000).toISOString();
}
/** O e-mail da conta precisa ser o da solicitação (sem diferença de maiúsculas/espaços). */
export function mesmoEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}
/** "d•••@gmail.com" — mostra a quem chega pelo link qual conta usar, sem expor o e-mail inteiro. */
export function emailMascarado(e: string | null | undefined): string {
  const t = String(e ?? "").trim();
  const i = t.lastIndexOf("@");
  return i < 1 ? "•••" : `${t[0]}•••${t.slice(i)}`;
}

// ── Checklist do admin ─────────────────────────────────────────────────────────────────────────────────────────
export const ITENS_CHECKLIST = [
  { chave: "identidade", rotulo: "Identidade conferida (CAF) ou conferência manual registrada" },
  { chave: "documento", rotulo: "CPF/CNPJ com dígitos válidos e situação conferida na Receita" },
  { chave: "area", rotulo: "Categorias e área de atendimento definidas" },
  { chave: "categoria", rotulo: "Item da categoria conferido (portfólio, empresa/veículo ou descrição)" },
] as const;
export type ChaveChecklist = (typeof ITENS_CHECKLIST)[number]["chave"];
export function checklistCompleto(c: Partial<Record<string, unknown>> | null | undefined): boolean {
  return ITENS_CHECKLIST.every((i) => c?.[i.chave] === true) && !!c?.documento_conferido_em;
}

export const MOTIVOS_RECUSA_PARCERIA = [
  "Não conseguimos confirmar a sua identidade ou o documento informado.",
  "No momento ainda não atendemos esta cidade com parceiros.",
  "O portfólio enviado não permitiu avaliar o serviço. Você pode enviar um novo pedido com outro link.",
  "As informações do serviço ficaram incompletas. Você pode enviar um novo pedido com mais detalhes.",
] as const;

// ── Página e publicação ────────────────────────────────────────────────────────────────────────────────────────
export const GALERIA_MAX = 30;
export const FOTOS_MIN_FOTOGRAFIA = 3;
const RESERVADOS = new Set(["buscar", "fotografos", "ativar", "seja-parceiro", "novo", "editar", "admin", "api", "dashboard"]);

export function slugBase(nome: string): string {
  const s = String(nome ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
  return !s || RESERVADOS.has(s) ? `parceiro-${s || "viva"}` : s;
}

export interface PaginaParaPublicar {
  avatarPath: string | null;
  descricao: string | null;
  servicosAtivos: number;
  cidades: string[];
  categorias: string[];
  fotosGaleria: number;
  /** FISCAL-PARCEIRO-B: PJ sem resposta não publica a primeira vez (quem já está no ar não sai). */
  tipoPessoa?: string | null;
  emiteNota?: boolean | null;
}

/** O que falta para publicar (vazio = pode publicar). */
export function faltaParaPublicar(p: PaginaParaPublicar): string[] {
  const f: string[] = [];
  if (!p.avatarPath) f.push("Foto de perfil");
  if (!p.descricao || p.descricao.trim().length < 30) f.push("Descrição profissional (pelo menos 30 caracteres)");
  if (p.servicosAtivos < 1) f.push("Pelo menos 1 serviço");
  if (!p.cidades.length) f.push("Pelo menos 1 cidade atendida");
  if (p.categorias.includes("fotografia") && p.fotosGaleria < FOTOS_MIN_FOTOGRAFIA) f.push(`${FOTOS_MIN_FOTOGRAFIA} fotos na galeria (fotografia)`);
  if (p.tipoPessoa !== undefined && faltaRespostaNota({ tipoPessoa: p.tipoPessoa, emiteNota: p.emiteNota })) f.push(PENDENCIA_NOTA);
  return f;
}

// ── Redes ──────────────────────────────────────────────────────────────────────────────────────────────────────
export const REDES = [
  { chave: "instagram", rotulo: "Instagram", dominios: ["instagram.com"] },
  { chave: "linkedin", rotulo: "LinkedIn", dominios: ["linkedin.com"] },
  { chave: "facebook", rotulo: "Facebook", dominios: ["facebook.com", "fb.com"] },
  { chave: "tiktok", rotulo: "TikTok", dominios: ["tiktok.com"] },
  { chave: "site", rotulo: "Site", dominios: [] as string[] },
] as const;
export type ChaveRede = (typeof REDES)[number]["chave"];

/** URL da rede: válida e do domínio certo (site aceita qualquer domínio). Vazio = remove. */
export function validarRede(chave: ChaveRede, u: string | null | undefined): { ok: true; valor: string | null } | { ok: false; erro: string } {
  if (!String(u ?? "").trim()) return { ok: true, valor: null };
  const url = urlPublicaValida(u);
  const rede = REDES.find((r) => r.chave === chave)!;
  if (!url) return { ok: false, erro: `${rede.rotulo}: endereço inválido.` };
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (rede.dominios.length && !rede.dominios.some((d) => host === d || host.endsWith(`.${d}`))) return { ok: false, erro: `${rede.rotulo}: use um link do ${rede.dominios[0]}.` };
  return { ok: true, valor: url };
}

// ── Recebimento (restrito) ─────────────────────────────────────────────────────────────────────────────────────
/** Só os 4 finais aparecem em tela. */
export function finalRecebimento(v: string | null | undefined): string {
  const t = String(v ?? "").replace(/\s+/g, "");
  return t.length <= 4 ? "••••" : `•••• ${t.slice(-4)}`;
}

// ── Serviço ────────────────────────────────────────────────────────────────────────────────────────────────────
export const UNIDADES_SERVICO = ["por serviço", "por hora", "por diária", "por m²", "por cômodo", "por peça"] as const;
export function textoPreco(preco: number | null | undefined, unidade: string | null | undefined): string {
  if (preco == null || !(preco > 0)) return "Sob consulta";
  const brl = `R$ ${Math.round(preco).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  return unidade ? `${brl} ${unidade}` : brl;
}

// ── Busca ──────────────────────────────────────────────────────────────────────────────────────────────────────
export interface ParceiroNaBusca {
  slug: string;
  categorias: string[];
  cidades: string[];
  notaMedia: number | null;
  avaliacoesQtd: number;
  publicadoEm: string | null;
  teste: boolean;
  status: string;
  lat?: number | null;
  lng?: number | null;
  raioKm?: number | null;
  tipoPessoa?: string | null;
  emiteNota?: boolean | null;
}

export function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Busca pública: só publicado. Conta de teste fica fora para o público e aparece só para quem também é conta de
 * teste ou admin (`verTeste`) — o QA acha o parceiro de teste e fecha o ciclo sem que um usuário real o veja.
 * Filtra por categoria e por cidade (a cidade está entre as atendidas) ou ponto do CEP (dentro do raio do parceiro).
 * Ordem: nota (com avaliação real) e depois os mais recentes.
 */
export function filtrarParceiros<T extends ParceiroNaBusca>(
  lista: T[],
  f: { categoria?: string | null; cidade?: string | null; ponto?: { lat: number; lng: number } | null; verTeste?: boolean; soNota?: boolean },
): T[] {
  const cid = chaveCidade(f.cidade ?? "");
  return lista
    .filter((p) => p.status === "publicado" && (!p.teste || f.verTeste === true))
    .filter((p) => !f.categoria || p.categorias.includes(f.categoria))
    .filter((p) => passaFiltroNota({ tipoPessoa: p.tipoPessoa, emiteNota: p.emiteNota }, f.soNota === true))
    .filter((p) => {
      if (!cid && !f.ponto) return true;
      const naCidade = !!cid && p.cidades.some((c) => chaveCidade(c) === cid);
      const noRaio = !!f.ponto && p.lat != null && p.lng != null && !!p.raioKm && distanciaKm(f.ponto, { lat: p.lat, lng: p.lng }) <= p.raioKm;
      return naCidade || noRaio;
    })
    .sort((a, b) => {
      const na = a.avaliacoesQtd > 0 ? (a.notaMedia ?? 0) : -1;
      const nb = b.avaliacoesQtd > 0 ? (b.notaMedia ?? 0) : -1;
      if (nb !== na) return nb - na;
      return Date.parse(b.publicadoEm ?? "1970-01-01") - Date.parse(a.publicadoEm ?? "1970-01-01");
    });
}

// ── Parceiro geral (cartão de reserva da busca vazia; desligado por padrão) ─────────────────────────────────────
export interface ParceiroGeral {
  ligado: boolean;
  nome: string;
  cidade: string;
  descricao: string;
}
export const PARCEIRO_GERAL_PADRAO: ParceiroGeral = { ligado: false, nome: "", cidade: "", descricao: "" };
export function lerParceiroGeral(v: unknown, ligada: boolean): ParceiroGeral {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { ligado: ligada, nome: limpar(o.nome as string, 80), cidade: limpar(o.cidade as string, 80), descricao: limpar(o.descricao as string, 300) };
}
export function mostrarParceiroGeral(g: ParceiroGeral, resultados: number): boolean {
  return g.ligado && resultados === 0 && !!g.nome;
}

// ── Imagens da página (recorte no navegador; o servidor só aceita WebP até 5 MB) ────────────────────────────────
export const FORMATOS_IMAGEM = {
  avatar: { proporcao: 1, maxLado: 512 },
  banner: { proporcao: 3, maxLado: 1800 },
  galeria: { proporcao: 0, maxLado: 1600 },
} as const;
export type TipoImagemParceiro = keyof typeof FORMATOS_IMAGEM;

/** Recorte central na proporção (0 = mantém a original) e o tamanho final (lado maior ≤ maxLado). */
export function recorteImagem(w: number, h: number, tipo: TipoImagemParceiro): { sx: number; sy: number; sw: number; sh: number; ow: number; oh: number } {
  const { proporcao, maxLado } = FORMATOS_IMAGEM[tipo];
  let sw = w;
  let sh = h;
  if (proporcao > 0) {
    if (w / h > proporcao) sw = Math.round(h * proporcao);
    else sh = Math.round(w / proporcao);
  }
  const escala = Math.min(1, maxLado / Math.max(sw, sh));
  return { sx: Math.floor((w - sw) / 2), sy: Math.floor((h - sh) / 2), sw, sh, ow: Math.max(1, Math.round(sw * escala)), oh: Math.max(1, Math.round(sh * escala)) };
}
