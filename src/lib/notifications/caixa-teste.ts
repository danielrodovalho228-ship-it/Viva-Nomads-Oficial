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
