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

// ── Prazo de resposta ao pedido de parceria (E791) ──────────────────────────────────────────────────────────────
/** O prazo PÚBLICO de resposta ao pedido de parceria: 7 dias, o mesmo que /empresas promete (E770) — decisão da vigia de 12/11
 *  (E791). Vale em todas as superfícies: /parceiros, o formulário depois de enviar e o onboarding. O alerta interno à equipe
 *  (lembretes: parceiroSemResposta, 24 h úteis) continua mais curto que a promessa pública, de propósito. */
export const PRAZO_RESPOSTA_PARCERIA = "7 dias";
export const TEXTO_PRAZO_PARCERIA = `A Viva responde por e-mail em até ${PRAZO_RESPOSTA_PARCERIA}.`;

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
/**
 * E729 (Phoenix/RELATORIO-002, C3): a exigência que uma categoria traz ao formulário (o campo extra só aparece depois de marcá-la)
 * é dita JUNTO da categoria, antes de marcar. Fonte única: a mesma validação do servidor (abaixo) exige estes campos.
 */
export const EXIGENCIA_DA_CATEGORIA: Readonly<Record<string, string>> = {
  fotografia: "Pede o link do portfólio",
  mudanca: "Pede empresa e veículo",
};
export const rotuloCategoria = (c: string) => CATEGORIAS_PARCEIRO.find((x) => x.valor === c)?.rotulo ?? "Serviço";
/** Categoria do catálogo (contratável). "vistoria" não entra: o avaliador nunca é escolhido nem contratado direto. */
export const categoriaValida = (c: string): c is CategoriaParceiro => CATEGORIAS_CATALOGO.some((x) => x.valor === c);

/** E447: a categoria escolhida na URL (?categoria=) entra marcada, sem desmarcar as outras nem duplicar. */
export function categoriasComDaUrl(atuais: readonly string[], daUrl: string | null | undefined): string[] {
  if (!daUrl || !categoriaValida(daUrl) || atuais.includes(daUrl)) return [...atuais];
  return [...atuais, daUrl];
}

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
/** E774 (regra E445): contato NUNCA é trocado, em nenhuma fase — nem depois do aceite. Fonte única do texto em Parceiros. */
export const CONTATO_PELA_VIVA = "Seu contato não é trocado: tudo se combina pelas mensagens da Viva.";

// ── Solicitação de parceria ────────────────────────────────────────────────────────────────────────────────────
/**
 * E648 — CNPJ para TODOS os parceiros, sem exceção de categoria (decisão do Daniel, 06/11/2026). CPF não é aceito em nenhuma
 * categoria: quem quiser ser parceiro abre empresa (MEI onde a atividade permite). Cadastros que ficaram com CPF (só massa de
 * teste hoje) não recebem serviço até apresentarem o CNPJ.
 */
export const MSG_SO_CNPJ = "A Viva só trabalha com parceiros que têm CNPJ, em qualquer categoria. O CPF não é aceito: abra o seu CNPJ (MEI, onde a atividade permite) e cadastre a empresa.";
export const PENDENCIA_CNPJ = "Apresentar o CNPJ (cadastros com CPF não recebem serviço)";
/** E649: o que o PARCEIRO com cadastro legado (CPF) lê no painel dele: a pendência e o que fazer para voltar a receber serviço. */
export const PENDENCIA_CNPJ_PAINEL = "Pendência: apresente o CNPJ para voltar a receber serviço (cadastros com CPF não recebem serviço).";

/** Só empresa (CNPJ) recebe serviço: pedido de orçamento, busca pública e designação. Sem tipo registrado = não recebe. */
export const parceiroPodeReceberServico = (tipoPessoa: string | null | undefined): boolean => tipoPessoa === "pj";

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
/**
 * E651: o documento do pedido de parceria, conferido do mesmo jeito no passo (antes de mandar a pessoa para o /auth) e no
 * servidor. CPF (11 dígitos, válido ou não) é a tentativa que o E648 recusa; o CNPJ precisa de 14 dígitos e dígitos
 * verificadores corretos. Devolve a mensagem de recusa ou null quando o CNPJ confere.
 */
export function validarDocumentoParceiro(documento: string | null | undefined): string | null {
  const doc = soDigitos(documento ?? "");
  if (doc.length === 11 || cpfValido(doc)) return MSG_SO_CNPJ;
  if (doc.length !== 14) return "Informe o CNPJ com 14 dígitos (00.000.000/0000-00).";
  if (!cnpjValido(doc)) return "CNPJ inválido: confira os números.";
  return null;
}

export function validarSolicitacao(e: SolicitacaoEntrada): { ok: true; valor: SolicitacaoValida } | { ok: false; erro: string } {
  const nome = limpar(e.nome, 120);
  if (nome.length < 3) return { ok: false, erro: "Informe o seu nome (ou o da empresa)." };
  // E648: só empresa. O tipo "pf" e qualquer CPF no campo do documento são recusados em todas as categorias.
  if (e.tipoPessoa === "pf") return { ok: false, erro: MSG_SO_CNPJ };
  const tipo = "pj" as const;
  const doc = soDigitos(e.documento);
  const erroDoc = validarDocumentoParceiro(e.documento);
  if (erroDoc) return { ok: false, erro: erroDoc };
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
  { chave: "documento", rotulo: "CNPJ com dígitos válidos e situação conferida na Receita" },
  { chave: "area", rotulo: "Categorias e área de atendimento definidas" },
  { chave: "categoria", rotulo: "Item da categoria conferido (portfólio, empresa/veículo ou descrição)" },
] as const;
export type ChaveChecklist = (typeof ITENS_CHECKLIST)[number]["chave"];
export function checklistCompleto(c: Partial<Record<string, unknown>> | null | undefined): boolean {
  return ITENS_CHECKLIST.every((i) => c?.[i.chave] === true) && !!c?.documento_conferido_em;
}

/**
 * E350 (decisão do Daniel, 01/11): os modelos de recusa de PARCERIA, um a um com o checklist do admin (identidade, documento,
 * área, categoria) e um para pedido incompleto. `rotulo` é o que o admin lê na ficha; `texto` vai no e-mail ao parceiro
 * recusado — o motivo e o próximo passo.
 */
export const MODELOS_RECUSA_PARCERIA = [
  {
    chave: "identidade",
    rotulo: "Identidade não confirmada",
    texto: "Não conseguimos confirmar a sua identidade com o documento com foto enviado. Para tentar de novo, envie um novo pedido de parceria e refaça a confirmação com um documento válido e legível.",
  },
  {
    chave: "documento",
    rotulo: "CNPJ não conferido",
    texto: "O CNPJ informado não pôde ser conferido na Receita Federal (número inválido ou situação irregular). Confira o número e a situação do CNPJ e envie um novo pedido de parceria.",
  },
  {
    chave: "area",
    rotulo: "Cidade ainda não atendida",
    texto: "Ainda não atendemos a sua cidade ou região com parceiros. Quando a Viva Nomads chegar à sua região, você pode enviar um novo pedido de parceria.",
  },
  {
    chave: "categoria",
    rotulo: "Serviço não pôde ser avaliado",
    texto: "O portfólio, a empresa ou veículo ou a descrição enviados não permitiram avaliar o serviço. Envie um novo pedido de parceria com um link de portfólio ou detalhes que mostrem o seu trabalho.",
  },
  {
    chave: "incompleto",
    rotulo: "Informações incompletas",
    texto: "As informações do pedido ficaram incompletas. Envie um novo pedido de parceria preenchendo todos os campos do serviço e da área de atendimento.",
  },
] as const;
export const MOTIVOS_RECUSA_PARCERIA = MODELOS_RECUSA_PARCERIA.map((m) => m.texto);

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
  /** E650: quem já esteve no ar não é barrado pela pergunta da nota, mas a pendência do CNPJ vale para todos. */
  jaPublicou?: boolean;
}

/** O que falta para publicar (vazio = pode publicar). */
export function faltaParaPublicar(p: PaginaParaPublicar): string[] {
  const f: string[] = [];
  if (!p.avatarPath) f.push("Foto de perfil");
  if (!p.descricao || p.descricao.trim().length < 30) f.push("Descrição profissional (pelo menos 30 caracteres)");
  if (p.servicosAtivos < 1) f.push("Pelo menos 1 serviço");
  if (!p.cidades.length) f.push("Pelo menos 1 cidade atendida");
  if (p.categorias.includes("fotografia") && p.fotosGaleria < FOTOS_MIN_FOTOGRAFIA) f.push(`${FOTOS_MIN_FOTOGRAFIA} fotos na galeria (fotografia)`);
  if (p.tipoPessoa !== undefined && !parceiroPodeReceberServico(p.tipoPessoa)) f.push(PENDENCIA_CNPJ);
  if (p.tipoPessoa !== undefined && !p.jaPublicou && faltaRespostaNota({ tipoPessoa: p.tipoPessoa, emiteNota: p.emiteNota })) f.push(PENDENCIA_NOTA);
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
  /** E650: quem já esteve no ar não é barrado pela pergunta da nota, mas a pendência do CNPJ vale para todos. */
  jaPublicou?: boolean;
}

/*
  E297 — o parceiro de teste segue a regra do anúncio de teste (E93): fora da busca e das listagens públicas para
  quem não é da equipe (filtrarParceiros), noindex na página, e uma faixa que diz por quê. A equipe (o próprio
  parceiro, o admin ou uma conta de teste) vê a página normal com a faixa discreta e pode pedir orçamento (o QA fecha
  o ciclo); qualquer outra pessoa, com ou sem login, vê a faixa de visitante e o pedido desativado.
*/
export const FAIXA_PARCEIRO_TESTE_VISITANTE = "Parceiro de teste da equipe Viva — não é um prestador disponível";
// E339 (01/11): a faixa diz a verdade conforme quem vê — a conta de teste (ou o admin) O VÊ na busca; o próprio parceiro
// lê que o público não o vê. O visitante real nem o encontra na busca (E297, sem mudança).
export const FAIXA_PARCEIRO_TESTE_EQUIPE = "Parceiro de teste: visível só para contas de teste";
export const FAIXA_PARCEIRO_TESTE_DONO = "Seu perfil de teste não aparece para o público";
export const PEDIDO_PARCEIRO_TESTE_RECUSADO = "Este é um parceiro de teste da equipe Viva e não recebe pedidos.";

export type ModoParceiroTeste = "visitante" | "equipe" | "dono" | null;

/** null = parceiro de verdade; "dono" = o próprio parceiro (E339); "equipe" = o admin ou uma conta de teste; "visitante" = qualquer outra pessoa. */
export function modoParceiroTeste(teste: boolean, quem: { dono: boolean; admin: boolean; teste: boolean }): ModoParceiroTeste {
  if (!teste) return null;
  if (quem.dono) return "dono";
  return quem.admin || quem.teste ? "equipe" : "visitante";
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
    // E648: cadastro que ficou só com CPF não aparece (não recebe serviço) até apresentar o CNPJ.
    .filter((p) => parceiroPodeReceberServico(p.tipoPessoa))
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
/**
 * E688 (decisão do Daniel, 08/11/2026): a saída "parceiro geral" (AquiResolve) fica FORA das superfícies públicas por ora —
 * não se promete o que não está cadastrado (o registro da Maira foi adiado em 18/10). Reversível: quando ela se cadastrar,
 * basta ligar esta constante (e a chave PARCEIRO_GERAL_FALLBACK no admin). A configuração no admin continua existindo.
 */
export const PARCEIRO_GERAL_NAS_SUPERFICIES = false;
export function mostrarParceiroGeral(g: ParceiroGeral, resultados: number, naSuperficie: boolean = PARCEIRO_GERAL_NAS_SUPERFICIES): boolean {
  return naSuperficie && g.ligado && resultados === 0 && !!g.nome;
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

/** E687 — empresa e veículo da categoria Mudança, como linhas para mostrar ao parceiro. Outras categorias: nada. */
export function linhasDadosDaCategoria(categorias: readonly string[], dados: { empresa?: unknown; veiculo?: unknown } | null | undefined): { rotulo: string; valor: string }[] {
  if (!dados || !categorias.includes("mudanca")) return [];
  const linhas: { rotulo: string; valor: string }[] = [];
  const empresa = typeof dados.empresa === "string" ? dados.empresa.trim() : "";
  const veiculo = typeof dados.veiculo === "string" ? dados.veiculo.trim() : "";
  if (empresa) linhas.push({ rotulo: "Empresa de mudança", valor: empresa });
  if (veiculo) linhas.push({ rotulo: "Veículo", valor: veiculo });
  return linhas;
}

/** E771: a divisão 90/10 vale só para SERVIÇOS de parceiros; o pagamento da estadia (/empresas, /buscar) vai direto ao proprietário. */
export const ESCOPO_PAGAMENTO_PARCEIROS = "Esta divisão vale só para os serviços de parceiros. O pagamento da estadia vai direto ao proprietário, e a Viva não toca nesse dinheiro.";
