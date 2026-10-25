/*
  PERFIS PÚBLICOS (prompt 6, 17/10) — regras puras, sem Supabase.
  Proprietário: nome curto, cidade, "Na Viva desde", contagens, resposta no chat, idiomas, bio e selos REAIS.
  Inquilino visto pelo proprietário: sem nome, foto e contato antes do aceite; depois, nome curto e foto.
  Contato (telefone/e-mail) nunca aparece em nenhum dos dois, em fase alguma.
*/
import { guardContactInfo } from "../messages/contact-guard.ts";

/** "Maria Souza Lima" → "Maria L."; um nome só → ele mesmo; vazio → null. */
export function nomeCurto(nome: string | null | undefined): string | null {
  // PROP-3 (E118): nome que é um e-mail não é nome (nunca mostra o e-mail; cai no rótulo neutro de quem chama).
  if ((nome ?? "").includes("@")) return null;
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return null;
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1].charAt(0).toUpperCase()}.`;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "Na Viva desde março de 2025". Data inválida → null. */
export function desdeLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `Na Viva desde ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/** Mínimo de conversas para mostrar taxa e tempo de resposta (abaixo disso: "Novo na Viva"). */
export const MIN_CONVERSAS_RESPOSTA = 3;

export interface MetricaResposta {
  taxa: number;
  tempo: string;
}

/** Taxa e tempo de resposta a partir das conversas reais; null com menos de 3 conversas. */
export function metricaResposta(conversas: number, respondidas: number, mediaMin: number | null): MetricaResposta | null {
  if (!Number.isFinite(conversas) || conversas < MIN_CONVERSAS_RESPOSTA) return null;
  const taxa = Math.round((Math.max(0, Math.min(respondidas, conversas)) / conversas) * 100);
  return { taxa, tempo: tempoRespostaLabel(mediaMin) };
}

export function tempoRespostaLabel(min: number | null): string {
  if (min == null || !Number.isFinite(min)) return "sem respostas ainda";
  if (min < 60) return "em menos de 1 hora";
  const h = Math.round(min / 60);
  if (h < 24) return `em cerca de ${h} ${h === 1 ? "hora" : "horas"}`;
  const d = Math.round(h / 24);
  return `em cerca de ${d} ${d === 1 ? "dia" : "dias"}`;
}

export const BIO_MAX = 280;

export type Validacao<T> = { ok: true; valor: T } | { ok: false; erro: string };

const LINK_RE = /(https?:\/\/|www\.)\S+|\b[\w-]+\.(com|com\.br|net|org|br|io|me)\b/i;

/** Bio: até 280 caracteres, sem telefone, e-mail, @ ou link (contact-guard + links). Vazia = apagar. */
export function validarBio(texto: string): Validacao<string | null> {
  const t = (texto ?? "").replace(/\s+/g, " ").trim();
  if (!t) return { ok: true, valor: null };
  if (t.length > BIO_MAX) return { ok: false, erro: `A bio tem no máximo ${BIO_MAX} caracteres.` };
  if (guardContactInfo(t).masked || LINK_RE.test(t))
    return { ok: false, erro: "Tire telefone, e-mail, @ ou link da bio: o contato fica protegido e a conversa segue pelo chat da Viva." };
  return { ok: true, valor: t };
}

export const IDIOMAS = ["Português", "Inglês", "Espanhol", "Francês", "Italiano", "Alemão", "Libras"] as const;

/** Só idiomas da lista, sem repetição, na ordem da lista. */
export function validarIdiomas(lista: readonly string[]): string[] {
  const set = new Set(lista);
  return IDIOMAS.filter((i) => set.has(i));
}

/** Cidade: texto curto, sem contato; vazia = apagar. */
export function validarCidade(texto: string): Validacao<string | null> {
  const t = (texto ?? "").replace(/\s+/g, " ").trim();
  if (!t) return { ok: true, valor: null };
  if (t.length > 60) return { ok: false, erro: "Use até 60 caracteres para a cidade." };
  if (guardContactInfo(t).masked || /\d{5}-?\d{3}/.test(t)) return { ok: false, erro: "Informe só a cidade, sem endereço ou contato." };
  return { ok: true, valor: t };
}

/** Selos que só aparecem com verificação REAL registrada. Telefone: código por SMS (prompt 7). Identidade: Certta (depois). */
export function selosReais(p: { emailConfirmado?: boolean | null; telefoneVerificado?: boolean | null; linkedinConectado?: boolean | null }): string[] {
  const s: string[] = [];
  if (p.emailConfirmado === true) s.push("E-mail confirmado");
  if (p.telefoneVerificado === true) s.push("Telefone verificado");
  // 63-B: só o selo (texto), nunca link, nome ou foto do LinkedIn. Não soma em ranking nem taxa.
  if (p.linkedinConectado === true) s.push("LinkedIn conectado");
  return s;
}

export interface CandidatoBase {
  nome: string | null;
  fotoUrl: string | null;
  profissao: string | null;
  motivo: string | null;
  inicioDesejado: string | null;
  /** Prompt 8: quantas pessoas vão morar (da candidatura). */
  qtdOcupantes?: number | null;
  pets: number;
  desde: string | null;
  reputacao: { media: number; n: number } | null;
  emailConfirmado: boolean;
  telefoneVerificado?: boolean;
  /** 63-B: LinkedIn conectado e dentro da validade. */
  linkedinConectado?: boolean;
}

export interface CartaoCandidato {
  titulo: string;
  fotoUrl: string | null;
  sinais: string[];
  selos: string[];
  reputacao: { media: number; n: number } | null;
}

/** O que o proprietário vê de quem se candidata: antes do aceite, nunca nome nem foto; contato nunca. */
export function cartaoCandidato(c: CandidatoBase, aceito: boolean): CartaoCandidato {
  const sinais: string[] = [];
  if (c.profissao) sinais.push(c.profissao);
  if (c.motivo) sinais.push(`Motivo: ${c.motivo}`);
  if (c.inicioDesejado) sinais.push(`A partir de ${c.inicioDesejado}`);
  if (c.qtdOcupantes && c.qtdOcupantes > 0) sinais.push(c.qtdOcupantes === 1 ? "Para 1 pessoa" : `Para ${c.qtdOcupantes} pessoas`);
  if (c.pets > 0) sinais.push(c.pets === 1 ? "Com 1 pet" : `Com ${c.pets} pets`);
  const desde = desdeLabel(c.desde);
  if (desde) sinais.push(desde);
  return {
    titulo: aceito ? (nomeCurto(c.nome) ?? "Candidato(a)") : "Candidato(a)",
    fotoUrl: aceito ? c.fotoUrl : null,
    sinais,
    selos: selosReais({ emailConfirmado: c.emailConfirmado, telefoneVerificado: c.telefoneVerificado, linkedinConectado: c.linkedinConectado }),
    reputacao: c.reputacao && c.reputacao.n > 0 ? c.reputacao : null,
  };
}

/**
 * Nome do outro lado em Mensagens (mesma regra do cartão do candidato):
 * - eu sou o proprietário do imóvel → "Candidato(a)" até o aceite; depois, nome curto;
 * - eu sou o inquilino → nome curto do proprietário (público, como no anúncio);
 * - conversa sem imóvel (suporte) → primeiro nome, como antes.
 */
export function nomeNaConversa(p: {
  papel: "proprietario" | "inquilino" | "suporte";
  nomeCompleto: string | null;
  aceito: boolean;
  primeiroNome?: string | null;
}): string {
  if (p.papel === "proprietario") return p.aceito ? (nomeCurto(p.nomeCompleto) ?? "Candidato(a)") : "Candidato(a)";
  if (p.papel === "inquilino") return nomeCurto(p.nomeCompleto) ?? (p.primeiroNome || "Proprietário");
  return p.primeiroNome || "Conversa";
}

/**
 * Nomes das partes NA PROPOSTA (Prompt 56, D4): nome completo, nunca o curto ("Daniel Teste 1" virava "Daniel 1.") e
 * sem CPF/CNPJ. O interessado continua "Candidato(a)" para o proprietário até o aceite da candidatura (prompt 6).
 */
export function nomeNaProposta(p: { quemVe: "owner" | "tenant"; nomeCompleto: string | null; aceito: boolean }): string {
  const nome = (p.nomeCompleto ?? "").replace(/\s+/g, " ").trim() || null;
  if (p.quemVe === "owner") return p.aceito && nome ? nome : "Candidato(a)";
  return nome ?? "Proprietário";
}

export interface ItemProgresso {
  chave: "foto" | "bio" | "idiomas" | "cidade" | "profissao" | "motivo" | "telefone";
  rotulo: string;
  feito: boolean;
}

/** Barra "Complete seu perfil": nunca obrigatória. Quem só procura casa também vê a profissão. */
export function progressoPerfil(
  p: { foto: boolean; bio: string | null; idiomas: string[]; cidade: string | null; profissao: string | null; motivo: string | null },
  /** telefone: undefined = verificação por SMS indisponível (o item não aparece). */
  opts: { anuncia: boolean; telefone?: boolean },
): { itens: ItemProgresso[]; pct: number } {
  const itens: ItemProgresso[] = [
    { chave: "foto", rotulo: "Foto de perfil", feito: p.foto },
    { chave: "bio", rotulo: "Uma frase sobre você", feito: !!p.bio },
    { chave: "idiomas", rotulo: "Idiomas", feito: p.idiomas.length > 0 },
    { chave: "cidade", rotulo: "Cidade", feito: !!p.cidade },
  ];
  // CONTA-A C2: o motivo da estadia NÃO entra na barra. Ele mora num lugar só (Dados da conta), onde "Prefiro não
  // informar" é uma resposta válida — e no banco vale o mesmo que "sem motivo"; contar como falta dava dois estados.
  if (!opts.anuncia) itens.push({ chave: "profissao", rotulo: "Profissão", feito: !!p.profissao });
  if (opts.telefone !== undefined)
    itens.push({ chave: "telefone", rotulo: "Verifique seu celular: perfis verificados passam mais confiança", feito: opts.telefone });
  const pct = Math.round((itens.filter((i) => i.feito).length / itens.length) * 100);
  return { itens, pct };
}

/** Página pública do proprietário: só indexa quando há imóvel visível (anúncio de teste não conta). */
export function robotsDoProprietario(imoveisVisiveis: number): { index: boolean; follow: boolean } {
  const indexar = imoveisVisiveis > 0;
  return { index: indexar, follow: indexar };
}

/** Rótulo curto de cada item na linha de faltas (o do celular é uma frase longa na lista). */
const CURTO: Partial<Record<string, string>> = { telefone: "Celular verificado" };
/** Rótulo curto de um item do medidor (a lista de marcação e a linha de faltas usam o mesmo). */
export const rotuloCurto = (i: { chave: string; rotulo: string }): string => CURTO[i.chave] ?? i.rotulo;

/**
 * CONTA-A C1 — o medidor declara o que conta e a linha de faltas lista TUDO o que falta: os itens do cadastro (nome,
 * e-mail confirmado, documento — os mesmos do admin) mais os da barra (foto, frase, idiomas, cidade, profissão,
 * celular). A foto está nos dois e conta uma vez. A porcentagem é sobre esta mesma lista.
 */
export function medidorPerfil(
  barra: ItemProgresso[],
  cadastro: { chave: string; rotulo: string; feito: boolean }[],
): { itens: { chave: string; rotulo: string; feito: boolean }[]; pct: number; falta: string[] } {
  const chaves = new Set(barra.map((i) => i.chave as string));
  const itens = [...cadastro.filter((i) => !chaves.has(i.chave)), ...barra];
  const pct = itens.length ? Math.round((itens.filter((i) => i.feito).length / itens.length) * 100) : 100;
  const falta = itens.filter((i) => !i.feito).map(rotuloCurto);
  return { itens, pct, falta };
}

/** "A, B e C" (vazio → ""). */
/**
 * Extra do E62 (aprovado 24/10): cada falta do medidor é tocável e leva ao lugar dela. "campo" = elemento desta tela
 * (data-testid) para rolar e focar; "rota" = outra tela da Conta (o que mora em Dados).
 */
export type DestinoFalta = { tipo: "campo"; alvo: string } | { tipo: "rota"; href: string };
const DESTINO_FALTA: Readonly<Record<string, DestinoFalta>> = {
  foto: { tipo: "campo", alvo: "topo-foto" },
  nome: { tipo: "campo", alvo: "perfil-nome" },
  bio: { tipo: "campo", alvo: "perfil-bio" },
  cidade: { tipo: "campo", alvo: "perfil-cidade" },
  idiomas: { tipo: "campo", alvo: "idiomas-toggle-bloco" },
  profissao: { tipo: "campo", alvo: "profissao-toggle-bloco" },
  email: { tipo: "rota", href: "/dashboard/conta/dados" },
  documento: { tipo: "rota", href: "/dashboard/conta/dados#documento" },
  telefone: { tipo: "rota", href: "/dashboard/conta/dados#celular" },
};
export function destinoDaFalta(chave: string): DestinoFalta {
  return DESTINO_FALTA[chave] ?? { tipo: "rota", href: "/dashboard/conta/dados" };
}

/** Extra do E62: o estado do "Salvar alterações" — há o que salvar × tudo salvo. */
export const ESTADO_SALVAR = { alterado: "Há alterações para salvar", salvo: "Tudo salvo" } as const;

/** E62: a linha do estado de sucesso do medidor (100%), no lugar da porcentagem, da barra e da lista do que já foi feito. */
export const LINHA_PERFIL_COMPLETO = "Tudo preenchido: é assim que os proprietários veem você.";

export function listaEmTexto(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}
