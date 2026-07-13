/**
 * Proteção de contato nas conversas (padrão de marketplaces).
 *
 * Mascara telefones, e-mails e links de mensageria externa trocados no chat,
 * ANTES de gravar/exibir. Motivo: a negociação segue registrada na plataforma
 * (trilha para disputas). Contato direto (telefone/e-mail) NÃO é trocado em fase
 * alguma — nem após o aceite; o aceite revela identidade (nome + foto), não
 * contato, e a conversa continua exclusivamente pela plataforma.
 *
 * Função pura e client-safe: usada no servidor (fonte da verdade, antes do
 * insert) e no cliente (eco otimista igual ao que o servidor grava).
 */

const MASK = "🔒 [contato protegido]";

/** E-mails. */
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]{2,}/g;

/**
 * Telefones: sequências de dígitos com separadores comuns ((), espaço, ., -)
 * somando 10+ dígitos (fixo/celular BR com DDD, com ou sem +55). Abaixo de 10
 * dígitos não mascara — evita falso positivo com CEP (8), datas e valores.
 */
const PHONE_CANDIDATE_RE = /\+?\d[\d\s().-]{7,}\d/g;

/** Links de mensageria externa (WhatsApp/Telegram) — tiram a conversa da trilha. */
const MESSENGER_RE = /(https?:\/\/)?(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|t\.me|telegram\.me)\/\S+/gi;

/** Perfis de rede social (instagram/facebook/tiktok) por URL. */
const SOCIAL_URL_RE = /(?:https?:\/\/)?(?:www\.)?(?:instagram|facebook|fb|tiktok)\.com\/\S+/gi;

/** @handle solto (ex.: @maria.silva) — típico "me chama no insta @...". Captura
 *  o char anterior para não colidir com e-mails (já mascarados antes). */
const HANDLE_RE = /(^|[^\w@])@([a-zA-Z0-9._]{2,30})/g;

export interface GuardResult {
  /** Texto com os contatos mascarados. */
  text: string;
  /** true se algo foi mascarado (para exibir o aviso ao usuário). */
  masked: boolean;
}

/** Mascara contatos diretos no texto da mensagem. */
export function guardContactInfo(input: string): GuardResult {
  let masked = false;
  let text = input;

  text = text.replace(MESSENGER_RE, () => {
    masked = true;
    return MASK;
  });
  text = text.replace(EMAIL_RE, () => {
    masked = true;
    return MASK;
  });
  text = text.replace(PHONE_CANDIDATE_RE, (m) => {
    const digits = m.replace(/\D/g, "");
    // 10–13 dígitos = telefone BR (fixo/celular, com/sem 55). Fora disso, mantém.
    if (digits.length < 10 || digits.length > 13) return m;
    masked = true;
    return MASK;
  });
  text = text.replace(SOCIAL_URL_RE, () => {
    masked = true;
    return MASK;
  });
  // @handle solto — roda por último (e-mails/URLs já mascarados). Preserva o
  // caractere anterior capturado.
  text = text.replace(HANDLE_RE, (_m, pre: string) => {
    masked = true;
    return `${pre}${MASK}`;
  });

  return { text, masked };
}

/** Aviso curto exibido quando algo foi mascarado. */
export const GUARD_NOTICE =
  "Para sua segurança, telefones e e-mails são protegidos no chat. A negociação segue toda pela plataforma — o contato direto não é trocado.";
