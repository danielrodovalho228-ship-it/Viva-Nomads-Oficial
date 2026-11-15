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
/** E445 (item 1): todo link externo vira este marcador; só o site da Viva passa. */
export const MASK_LINK = "[link protegido]";
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
const PHONE_CANDIDATE_RE = /\+?\(?\d[\d\s().-]{7,}\d\)?/g;

/**
 * E483: o "(" do DDD fazia parte do telefone mas ficava fora da máscara — "([contato protegido]". O candidato agora
 * pode começar em "(" e terminar em ")"; o parêntese que sobra sem par no trecho (abre ou fecha fora do número)
 * volta para o texto, para a frase continuar equilibrada.
 */
function mascararTelefone(m: string): string {
  const abre = (m.match(/\(/g) ?? []).length;
  const fecha = (m.match(/\)/g) ?? []).length;
  if (abre > fecha && m.startsWith("(")) return `(${MASK}`;
  if (fecha > abre && m.endsWith(")")) return `${MASK})`;
  return MASK;
}

/** Links de mensageria externa (WhatsApp/Telegram) — tiram a conversa da trilha. */
const MESSENGER_RE = /(https?:\/\/)?(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|t\.me|telegram\.me)\/\S+/gi;

/** Perfis de rede social (instagram/facebook/tiktok) por URL. */
const SOCIAL_URL_RE = /(?:https?:\/\/)?(?:www\.)?(?:instagram|facebook|fb|tiktok)\.com\/\S+/gi;

/**
 * E445 (item 1): TODO link externo — http(s)://…, www.…, encurtadores (bit.ly, goo.gl, t.co…) e domínio sem "www"
 * com terminação comum (airbnb.com, booking.com.br, meusite.net…). Só vivanomads.com.br (e subdomínios) passa.
 * Domínio "solto" só com terminação da lista, para não pegar fim de frase ("Uberlândia.Até") nem valores ("3.200").
 */
const TLDS = "com\\.br|net\\.br|org\\.br|com|net|org|br|io|me|ly|co|app|link|site|info|biz|xyz|gl|gd|to|tv|online|store|page|ws|cc";
const LINK_RE = new RegExp(
  `(?:https?:\\/\\/[^\\s<>"']+|\\bwww\\.[^\\s<>"']+|\\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+(?:${TLDS})\\b(?:[/?#][^\\s<>"']*)?)`,
  "gi",
);
const DOMINIO_VIVA_RE = /^(?:https?:\/\/)?(?:[a-z0-9-]+\.)*vivanomads\.com\.br(?:[/?#:]|[.,;!)]*$)/i;

/** O link é do próprio site (pode ficar no chat)? */
export function linkDaViva(link: string): boolean {
  return DOMINIO_VIVA_RE.test(link.replace(/^www\./i, ""));
}

/** @handle solto (ex.: @maria.silva) — típico "me chama no insta @...". Captura
 *  o char anterior para não colidir com e-mails (já mascarados antes). */
const HANDLE_RE = /(^|[^\w@])@([a-zA-Z0-9._]{2,30})/g;

/** Ids (UUID) não são contato: trocados por marcador sem dígitos antes das regras e devolvidos no fim. */
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/**
 * Família 6, parte C — números da casa não são contato: pedido "VN-PD-11281A61", contrato "VN-CT-11281A61" (e o aditivo
 * "-AD1"), "VN-CT-2026-0042", "CT-11281A61" e orçamento "ORC-2026-0007". Saem do texto como os UUIDs e voltam no fim.
 * Só os FORMATOS reais (no máximo 8 algarismos): um prefixo da casa na frente de um telefone (10+) não o esconde.
 */
const CODIGO_DA_CASA_RE = /\b(?:(?:VN-(?:PD|CT)|CT)-[0-9A-F]{8}(?:-AD\d{1,3})?|VN-CT-\d{4}-\d{4}|ORC-\d{4}-\d{4})\b/g;

/**
 * Família 6, parte C — algarismos por extenso. Um "telefone falado" é uma sequência de algarismos e/ou palavras de
 * algarismo (zero…nove), separados por espaço, ponto, hífen ou "e", com 8 algarismos ou mais e pelo menos UMA palavra.
 * Sequência só de algarismos continua na regra de telefone de sempre (10–13): CEP (8), datas e valores não mudam.
 */
const PALAVRA_DIGITO: Record<string, string> = {
  zero: "0", um: "1", uma: "1", dois: "2", duas: "2", "três": "3", tres: "3", quatro: "4", cinco: "5", seis: "6", meia: "6", sete: "7", oito: "8", nove: "9",
};
const TOKEN_NUM = `(?:\\d+|${Object.keys(PALAVRA_DIGITO).join("|")})`;
const SEP_NUM = "(?:[\\s.\\-]+(?:e\\s+)?)";
const SEQ_NUM = `${TOKEN_NUM}(?:${SEP_NUM}${TOKEN_NUM})*`;
const NUM_FALADO_RE = new RegExp(`(?<![\\p{L}\\d])${TOKEN_NUM}(?:${SEP_NUM}${TOKEN_NUM})+(?![\\p{L}\\d])`, "giu");
/** Quantos algarismos a sequência diz, e se tem ao menos uma palavra. */
function lerSequencia(m: string): { digitos: number; temPalavra: boolean } {
  let digitos = 0;
  let temPalavra = false;
  for (const t of m.toLowerCase().split(/[\s.\-]+/)) {
    if (!t || t === "e") continue;
    if (/^\d+$/.test(t)) digitos += t.length;
    else if (t in PALAVRA_DIGITO) {
      digitos += 1;
      temPalavra = true;
    }
  }
  return { digitos, temPalavra };
}

/**
 * Família 6, parte C — e-mail ofuscado: "nome arroba gmail ponto com", "nome [at] gmail [dot] com", "nome @ gmail . com",
 * "nome(at)hotmail(dot)com", com ".com.br" por extenso também.
 */
const ARROBA_OFUSCADA = "(?:\\s*@\\s*|\\s*[[(]\\s*(?:at|arroba)\\s*[\\])]\\s*|\\s+arroba\\s+)";
const PONTO_OFUSCADO = "(?:\\s*\\.\\s*|\\s*[[(]\\s*(?:dot|ponto)\\s*[\\])]\\s*|\\s+(?:ponto|dot)\\s+)";
const EMAIL_OFUSCADO_RE = new RegExp(`[\\w.+-]+${ARROBA_OFUSCADA}[\\w-]+(?:${PONTO_OFUSCADO}(?:com|net|org|br|edu|gov|io))+\\b`, "gi");

/**
 * Família 6, parte C — mensageiro citado sem link ("me chama no zap / whats / wpp / telegram") SEGUIDO de um número,
 * mesmo parcial (4 algarismos ou mais, em algarismos ou por extenso): o número some, a palavra fica. Sem número logo
 * depois (só "no zap", "às 14h30"…), nada é mascarado.
 */
const MENSAGEIRO_CITADO_RE = new RegExp(
  `(\\b(?:zap(?:zap)?|whats(?:app)?|wpp|zapp|telegram|telegrama)\\b(?:\\s*[:\\-]\\s*|\\s+(?:é|e|no|o|meu|n[º°o]\\.?|n[uú]mero)\\s+|\\s+)*)(\\+?\\(?${SEQ_NUM}\\)?)`,
  "giu",
);

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
  const guardar = (id: string) => {
    ids.push(id);
    return String.fromCharCode(0xe000 + ids.length - 1);
  };
  let text = input.replace(UUID_RE, guardar).replace(CODIGO_DA_CASA_RE, guardar);

  text = text.replace(MESSENGER_RE, () => {
    masked = true;
    return MASK;
  });
  text = text.replace(EMAIL_RE, () => {
    masked = true;
    return MASK;
  });
  // Família 6 C: e-mail ofuscado ("arroba", "[at]", "@ gmail . com"), antes dos links ("gmail.com" sozinho viraria link).
  text = text.replace(EMAIL_OFUSCADO_RE, () => {
    masked = true;
    return MASK;
  });
  // E445: links externos (antes do telefone, para o número dentro de um link não virar "telefone" pela metade).
  // Perfis de rede social seguem com o marcador de contato (regra abaixo), por isso ficam de fora aqui.
  text = text.replace(LINK_RE, (m) => {
    if (linkDaViva(m)) return m;
    if (SOCIAL_URL_RE.test(m)) {
      SOCIAL_URL_RE.lastIndex = 0;
      return m;
    }
    SOCIAL_URL_RE.lastIndex = 0;
    masked = true;
    return MASK_LINK;
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
  // Família 6 C: mensageiro citado + número (mesmo parcial): some o número, a palavra fica.
  text = text.replace(MENSAGEIRO_CITADO_RE, (m, chave: string, numero: string) => {
    const { digitos } = lerSequencia(numero);
    if (digitos < 4) return m;
    masked = true;
    return `${chave}${MASK}`;
  });
  // Família 6 C: telefone falado ou misto (8+ algarismos com ao menos uma palavra de algarismo).
  text = text.replace(NUM_FALADO_RE, (m) => {
    const { digitos, temPalavra } = lerSequencia(m);
    if (!temPalavra || digitos < 8) return m;
    masked = true;
    return MASK;
  });
  text = text.replace(PHONE_CANDIDATE_RE, (m) => {
    const digits = m.replace(/\D/g, "");
    // 10–13 dígitos = telefone BR (fixo/celular, com/sem 55). Fora disso, mantém.
    if (digits.length < 10 || digits.length > 13) return m;
    masked = true;
    return mascararTelefone(m);
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
  "Para sua segurança, telefones, e-mails e links externos são protegidos no chat. A negociação segue toda pela plataforma — o contato direto não é trocado.";

/** Envio bloqueado quando a mensagem traz CPF ou RG (Prompt 32): o link leva ao campo Ocupantes da estadia. */
export const DOCUMENTO_BLOQUEADO = "Para dados de documento, use o campo Ocupantes da estadia";
/** Prompt 58: aviso fixo no rodapé de toda conversa. */
export const AVISO_DOCUMENTOS = "Não envie documentos por aqui. Para dados de ocupantes, use a página da estadia.";
