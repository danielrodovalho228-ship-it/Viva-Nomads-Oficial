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

const MASK = "[contato protegido]";
const MASK_DOC = "[documento protegido]";

/**
 * Documentos (Prompt 32, item 3): CPF com ou sem máscara — só com dígito verificador válido, para não pegar números
 * comuns (11 dígitos com DV inválido continuam no filtro de telefone) — e RG (máscara 12.345.678-9, prefixo de UF
 * "MG-12.345.678" ou o rótulo "RG"). Dados de documento vão no campo Ocupantes da estadia, nunca no chat.
 */
const CPF_CANDIDATE_RE = /(?<![\d.-])\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2}(?![\d-])/g;
const RG_MASCARA_RE = /(?<![\w.])(?:[A-Z]{2}[-\s]?)?\d{1,2}\.\d{3}\.\d{3}(?:-[\dXx])?(?![\w.])/g;
const RG_ROTULO_RE = /\b(?:RG|R\.G\.|identidade)\s*(?:n[ºo°]?\.?\s*)?[:\-]?\s*(?:[A-Z]{2}[-\s]?)?[\d.\-xX]{5,15}/gi;

/** CPF válido (11 dígitos, não repetidos, DV certo). */
export function cpfValido(digitos: string): boolean {
  const d = digitos.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

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

/** Ids (UUID) não são contato: trocados por marcador sem dígitos antes das regras e devolvidos no fim. */
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export interface GuardResult {
  /** Texto com os contatos mascarados. */
  text: string;
  /** true se algo foi mascarado (para exibir o aviso ao usuário). */
  masked: boolean;
  /** true se havia CPF ou RG: o envio pelo chat é bloqueado (vai no campo Ocupantes da estadia). */
  documento: boolean;
}

/** Mascara contatos diretos no texto da mensagem. */
export function guardContactInfo(input: string): GuardResult {
  let masked = false;
  let documento = false;
  const ids: string[] = [];
  let text = input.replace(UUID_RE, (id) => {
    ids.push(id);
    return String.fromCharCode(0xe000 + ids.length - 1);
  });

  text = text.replace(MESSENGER_RE, () => {
    masked = true;
    return MASK;
  });
  text = text.replace(EMAIL_RE, () => {
    masked = true;
    return MASK;
  });
  // Documentos antes do telefone: um CPF de 11 dígitos com DV válido não vira "telefone".
  text = text.replace(RG_ROTULO_RE, () => {
    documento = masked = true;
    return MASK_DOC;
  });
  text = text.replace(CPF_CANDIDATE_RE, (m) => {
    if (!cpfValido(m)) return m;
    documento = masked = true;
    return MASK_DOC;
  });
  text = text.replace(RG_MASCARA_RE, () => {
    documento = masked = true;
    return MASK_DOC;
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

  text = text.replace(/[\ue000-\uf8ff]/g, (c) => ids[c.charCodeAt(0) - 0xe000] ?? c);

  return { text, masked, documento };
}

/** Aviso curto exibido quando algo foi mascarado. */
export const GUARD_NOTICE =
  "Para sua segurança, telefones e e-mails são protegidos no chat. A negociação segue toda pela plataforma — o contato direto não é trocado.";

/** Envio bloqueado quando a mensagem traz CPF ou RG (Prompt 32): o link leva ao campo Ocupantes da estadia. */
export const DOCUMENTO_BLOQUEADO = "Para dados de documento, use o campo Ocupantes da estadia";
