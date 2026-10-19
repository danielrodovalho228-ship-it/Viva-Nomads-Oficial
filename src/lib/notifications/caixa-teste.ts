/**
 * Caixa de e-mails de teste (ordem 7436a29a, item 4) — parte pura, sem banco.
 * Todo e-mail transacional para uma conta de teste (profiles.is_teste) é guardado para o QA ler em
 * /admin/emails-teste, sem depender de encaminhamento manual. Guardamos só texto puro, o destinatário
 * mascarado e um corte de tamanho: nada de HTML, links com token ou e-mail completo.
 */

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
  /** Só os NOMES dos anexos (ex.: "REC-2026-000004.pdf"); o conteúdo nunca é guardado. */
  anexos?: string[];
}

/** Linha "Anexo: REC-2026-000004.pdf" no fim do corpo: o QA vê que o PDF foi junto, sem o conteúdo na tabela. */
export function corpoComAnexos(texto: string, anexos: string[] | undefined): string {
  const nomes = (anexos ?? []).map((n) => n.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 120)).filter(Boolean);
  if (!nomes.length) return texto;
  return `${texto}\n\n${nomes.length === 1 ? "Anexo" : "Anexos"}: ${nomes.join(", ")}`;
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
    const { error } = await admin.from("emails_teste").insert(montarRegistroEmailTeste({ ...p, texto: corpoComAnexos(semLinksComToken(p.texto), p.anexos), usuarioId: conta.id }));
    return !error;
  } catch {
    return false;
  }
}
