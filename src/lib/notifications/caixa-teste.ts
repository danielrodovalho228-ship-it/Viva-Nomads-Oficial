/**
 * Caixa de e-mails de teste (ordem 7436a29a, item 4) — parte pura, sem banco.
 * Todo e-mail transacional para uma conta de teste (profiles.is_teste) é guardado para o QA ler em
 * /admin/emails-teste, sem depender de encaminhamento manual. Guardamos só texto puro, o destinatário
 * mascarado e um corte de tamanho: nada de HTML, links com token ou e-mail completo.
 */

import { REMETENTE_EMAIL, REMETENTE_INTERNO_PADRAO } from "./remetente.ts";

export const CORPO_MAX = 6000;
export const ASSUNTO_MAX = 200;
/** Quantos e-mails a tela mostra (os mais novos). */
export const LISTA_MAX = 100;

/** "ana.souza@lab.vivanomads.test" → "a•••@lab.vivanomads.test". Nunca o e-mail completo. */
export function mascararDestinatario(email: string | null | undefined): string {
  const e = (email ?? "").trim();
  const arroba = e.lastIndexOf("@");
  if (arroba < 1 || arroba === e.length - 1) return "•••";
  return `${e.slice(0, 1)}•••@${e.slice(arroba + 1)}`;
}

export interface RegistroEmailTeste {
  evento: string;
  assunto: string;
  corpo: string;
  destinatario_mascarado: string;
  usuario_id: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Monta a linha a gravar: corta tamanhos e tira caracteres de controle. */
export function montarRegistroEmailTeste(p: {
  evento: string;
  assunto: string;
  texto: string;
  para: string;
  usuarioId?: string | null;
}): RegistroEmailTeste {
  const limpo = (s: string, max: number) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
  return {
    evento: limpo(p.evento, 60),
    assunto: limpo(p.assunto, ASSUNTO_MAX),
    corpo: limpo(p.texto, CORPO_MAX),
    destinatario_mascarado: mascararDestinatario(p.para),
    usuario_id: p.usuarioId && UUID_RE.test(p.usuarioId) ? p.usuarioId : null,
  };
}

/** O mínimo do cliente de serviço que a caixa usa (permite testar sem banco). */
export interface ClienteCaixaTeste {
  from(tabela: string): {
    select(colunas: string): {
      eq(coluna: string, valor: unknown): {
        limit(n: number): {
          eq(coluna: string, valor: unknown): PromiseLike<{ data: unknown[] | null }>;
        };
      };
    };
    insert(linha: RegistroEmailTeste): PromiseLike<{ error: unknown }>;
  };
}

export interface EmailParaCaixa {
  evento: string;
  assunto: string;
  texto: string;
  para: string;
  usuarioId?: string;
  /** Remetente e imagem de cabeçalho: vão no topo do corpo, para o QA conferir sem abrir o HTML. */
  remetente?: string;
  imagem?: string;
  /** Só os NOMES dos anexos (ex.: "REC-2026-000004.pdf"); o conteúdo nunca é guardado. */
  anexos?: string[];
}

/** Linha "Anexo: REC-2026-000004.pdf" no fim do corpo: o QA vê que o PDF foi junto, sem o conteúdo na tabela. */
export function corpoComAnexos(texto: string, anexos: string[] | undefined): string {
  const nomes = (anexos ?? []).map((n) => n.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 120)).filter(Boolean);
  if (!nomes.length) return texto;
  return `${texto}\n\n${nomes.length === 1 ? "Anexo" : "Anexos"}: ${nomes.join(", ")}`;
}

/** "Remetente: …" e "Imagem: …" no topo do corpo guardado. */
export function corpoComCabecalho(texto: string, p: { remetente?: string; imagem?: string }): string {
  const linhas = [p.remetente ? `Remetente: ${p.remetente}` : "", p.imagem ? `Imagem: ${p.imagem}` : ""].filter(Boolean);
  return linhas.length ? `${linhas.join("\n")}\n\n${texto}` : texto;
}

/** Links com token (exclusão de conta, recuperação…) nunca vão para a caixa: viram "[link com token removido]". */
export function semLinksComToken(texto: string): string {
  return texto.replace(/https?:\/\/\S*[?&](?:token|code|codigo|access_token|t)=\S*/gi, "[link com token removido]");
}

/**
 * Guarda o e-mail na caixa de testes SE o destinatário é conta de teste (profiles.is_teste). Conta real: nada é
 * gravado. Nunca lança (o envio real não depende disto).
 */
export async function guardarNaCaixaTeste(admin: ClienteCaixaTeste, p: EmailParaCaixa): Promise<boolean> {
  try {
    const q = admin.from("profiles").select("id").eq("is_teste", true).limit(1);
    const { data } = await (p.usuarioId ? q.eq("id", p.usuarioId) : q.eq("email", p.para.trim().toLowerCase()));
    const conta = (data ?? [])[0] as { id: string } | undefined;
    if (!conta) return false;
    const { error } = await admin.from("emails_teste").insert(montarRegistroEmailTeste({ ...p, texto: corpoComCabecalho(corpoComAnexos(semLinksComToken(p.texto), p.anexos), p), usuarioId: conta.id }));
    return !error;
  } catch {
    return false;
  }
}

/** Endereços da própria plataforma (remetentes públicos): ficam legíveis para o QA conferir de quem saiu. */
const ENDERECOS_DA_PLATAFORMA = new Set([REMETENTE_EMAIL, REMETENTE_INTERNO_PADRAO.replace(/^.*<|>$/g, "")].map((e) => e.toLowerCase()));
const EMAIL_NO_TEXTO_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;

/** Todo e-mail dentro do texto vira "a•••@dominio" (menos o remetente da plataforma): a tela nunca mostra endereço completo. */
export function mascararEmailsNoTexto(texto: string): string {
  return texto.replace(EMAIL_NO_TEXTO_RE, (e) => (ENDERECOS_DA_PLATAFORMA.has(e.toLowerCase()) ? e : mascararDestinatario(e)));
}

/** Quem abre /dashboard/qa/emails: conta de teste COM a marca de leitor de QA (só o servidor liga; migração 0246). */
export function podeLerCaixasQa(perfil: { qa_leitor?: boolean | null; is_teste?: boolean | null } | null | undefined): boolean {
  return perfil?.qa_leitor === true && perfil?.is_teste === true;
}

/** A área do leitor de QA (/dashboard/qa/…): o proxy devolve 404 DE VERDADE a quem não pode (a página sozinha sairia 200). */
export function rotaLeitorQa(pathname: string): boolean {
  return pathname === "/dashboard/qa" || pathname.startsWith("/dashboard/qa/");
}

export interface LinhaEmailTeste {
  id: string;
  criado_em: string;
  evento: string;
  assunto: string;
  corpo: string;
  destinatario_mascarado: string;
}

/** A linha como a tela mostra: e-mails mascarados e links com token removidos de novo (defesa em profundidade). */
export function linhaParaTela<T extends LinhaEmailTeste>(l: T): T {
  const limpa = (s: string) => mascararEmailsNoTexto(semLinksComToken(s));
  return { ...l, assunto: limpa(l.assunto), corpo: limpa(l.corpo), destinatario_mascarado: mascararEmailsNoTexto(l.destinatario_mascarado) };
}

export interface OpcoesFiltroQa {
  contas: { id: string; rotulo: string }[];
  eventos: string[];
}

/** Opções dos filtros a partir das próprias linhas (sem ler outra tabela): conta pelo destinatário mascarado. */
export function opcoesFiltroQa(linhas: { usuario_id: string | null; destinatario_mascarado: string; evento: string }[]): OpcoesFiltroQa {
  const contas = new Map<string, Set<string>>();
  const eventos = new Set<string>();
  for (const l of linhas) {
    if (l.evento) eventos.add(l.evento);
    if (!l.usuario_id) continue;
    const r = contas.get(l.usuario_id) ?? new Set<string>();
    r.add(mascararEmailsNoTexto(l.destinatario_mascarado));
    contas.set(l.usuario_id, r);
  }
  return {
    contas: [...contas].map(([id, r]) => ({ id, rotulo: `${[...r].sort().join(" / ")} · ${id.slice(0, 8)}` })).sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR")),
    eventos: [...eventos].sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}

/** Filtro da URL (?conta=&evento=): só vale um id de conta que existe nas opções e um evento conhecido; o resto é ignorado. */
export function filtroQaDaUrl(sp: { conta?: string | string[]; evento?: string | string[] }, opcoes: OpcoesFiltroQa): { conta: string | null; evento: string | null } {
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const conta = um(sp.conta);
  const evento = um(sp.evento);
  return {
    conta: UUID_RE.test(conta) && opcoes.contas.some((c) => c.id === conta) ? conta : null,
    evento: opcoes.eventos.includes(evento) ? evento : null,
  };
}
