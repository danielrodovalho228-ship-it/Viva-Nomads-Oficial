/*
  63-B — Selo "LinkedIn conectado". Regras PURAS (sem banco nem rede): o nome do LinkedIn confere com o da conta, o
  segredo do fluxo (state, nonce, PKCE) num cookie assinado, a conferência do id_token (assinatura RS256 pela chave
  pública do JWKS, iss, aud, exp, nonce), o hash do `sub` (um LinkedIn por conta) e a validade de 12 meses com aviso
  30 dias antes. Do id_token só se usa sub, given_name e family_name; o access token é descartado.
  Não é login: o fluxo nunca cria conta, autentica nem vincula identidade no Supabase Auth.
  Roda: node --test src/lib/linkedin/regras.test.ts
*/
import { createHash, createHmac, createPublicKey, randomBytes, timingSafeEqual, verify, type JsonWebKey } from "node:crypto";

export const SELO_LINKEDIN = "LinkedIn conectado";
export const VALIDADE_MESES = 12;
export const AVISO_DIAS_ANTES = 30;
export const VIDA_COOKIE_SEG = 10 * 60;
export const ESCOPO = "openid profile";
/** Cookie httpOnly assinado com state, nonce e PKCE (só no caminho /api/conta/linkedin). */
export const COOKIE_FLUXO = "vn_linkedin_fluxo";

export const MSG_NOME_DIVERGENTE = "O nome no LinkedIn não confere com o nome da sua conta.";
export const MSG_JA_CONECTADO = "Este LinkedIn já está conectado a outra conta.";
export const MSG_FALHA = "Não foi possível conectar o LinkedIn agora. Tente de novo.";
export const MSG_LIMITE = "Muitas tentativas. Tente de novo em uma hora.";
export const MSG_AVISO_VENCENDO = "Reconecte seu LinkedIn para manter o selo";

// ── Nome ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Partículas que não contam como sobrenome ("Maria da Silva" e "Maria Silva" têm "silva" em comum). */
const PARTICULAS = new Set(["da", "de", "do", "das", "dos", "e", "di", "du", "del", "van", "von", "la", "le"]);

/** Sem acento, sem caixa, só letras; separa em palavras. */
export function palavrasDoNome(nome: string | null | undefined): string[] {
  return (nome ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, " ")
    .split(/[\s'-]+/)
    .filter((p) => p.length > 0);
}

/**
 * O nome do LinkedIn confere com o da conta Viva: 1º nome igual e pelo menos 1 sobrenome em comum (sem acento, sem
 * caixa, sem partículas). Nome do meio de um lado só não atrapalha.
 */
export function nomeCompativel(contaViva: string | null | undefined, linkedin: { given_name?: string | null; family_name?: string | null }): boolean {
  const conta = palavrasDoNome(contaViva);
  const dados = palavrasDoNome(linkedin.given_name);
  const familia = palavrasDoNome(linkedin.family_name);
  if (conta.length < 2 || dados.length < 1 || familia.length < 1) return false;
  if (conta[0] !== dados[0]) return false;
  const sobrenomesConta = new Set(conta.slice(1).filter((p) => !PARTICULAS.has(p)));
  // O sobrenome em comum vem do family_name (nome do meio no given_name, como "Ana Clara", não conta como sobrenome).
  return familia.filter((p) => !PARTICULAS.has(p)).some((p) => sobrenomesConta.has(p));
}

// ── Um LinkedIn por conta ────────────────────────────────────────────────────────────────────────────────────────────

/** Só o hash do `sub` é gravado (HMAC-SHA256 com o segredo do servidor): o banco não guarda o identificador do LinkedIn. */
export function hashDoSub(sub: string, segredo: string): string {
  return createHmac("sha256", segredo).update(`linkedin-sub:${sub}`).digest("hex");
}

// ── State, nonce e PKCE num cookie assinado ──────────────────────────────────────────────────────────────────────────

export interface SegredoDoFluxo {
  state: string;
  nonce: string;
  verificador: string;
  /** Conta Viva que começou o fluxo (o retorno exige a MESMA sessão). */
  uid: string;
  /** Epoch em segundos. */
  exp: number;
}

const b64url = (b: Buffer) => b.toString("base64url");

export function novoSegredoDoFluxo(uid: string, agora = new Date()): SegredoDoFluxo {
  return {
    state: b64url(randomBytes(24)),
    nonce: b64url(randomBytes(24)),
    verificador: b64url(randomBytes(48)),
    uid,
    exp: Math.floor(agora.getTime() / 1000) + VIDA_COOKIE_SEG,
  };
}

/** code_challenge do PKCE (S256). */
export function desafioPkce(verificador: string): string {
  return b64url(createHash("sha256").update(verificador).digest());
}

export function assinarCookie(s: SegredoDoFluxo, chave: string): string {
  const corpo = b64url(Buffer.from(JSON.stringify(s)));
  return `${corpo}.${b64url(createHmac("sha256", chave).update(corpo).digest())}`;
}

/** Confere a assinatura e a validade (10 min). Qualquer coisa estranha → null. */
export function lerCookie(valor: string | null | undefined, chave: string, agora = new Date()): SegredoDoFluxo | null {
  if (!valor) return null;
  const [corpo, ass] = valor.split(".");
  if (!corpo || !ass) return null;
  const esperada = createHmac("sha256", chave).update(corpo).digest();
  const recebida = Buffer.from(ass, "base64url");
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return null;
  try {
    const s = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as SegredoDoFluxo;
    if (typeof s.state !== "string" || typeof s.nonce !== "string" || typeof s.verificador !== "string" || typeof s.uid !== "string") return null;
    if (typeof s.exp !== "number" || s.exp * 1000 < agora.getTime()) return null;
    return s;
  } catch {
    return null;
  }
}

/** O retorno vale só com o mesmo state, a mesma conta e o cookie dentro do prazo. */
export function retornoConfere(cookie: SegredoDoFluxo | null, p: { state: string | null; uid: string | null }): cookie is SegredoDoFluxo {
  if (!cookie || !p.state || !p.uid) return false;
  const a = Buffer.from(cookie.state);
  const b = Buffer.from(p.state);
  return a.length === b.length && timingSafeEqual(a, b) && cookie.uid === p.uid;
}

// ── id_token ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export type IdTokenConferido = { ok: true; sub: string; given_name: string; family_name: string } | { ok: false; erro: string };

/** JWK pública (RSA) do JWKS do provedor. */
export type ChavePublica = JsonWebKey & { kid?: string; kty?: string; alg?: string; use?: string };

/**
 * Confere o id_token: RS256 assinado por uma chave do JWKS (pelo kid), iss e aud exatos, exp no futuro (60 s de folga),
 * iat não absurdo e o nonce do fluxo. Devolve só sub, given_name e family_name.
 */
export function conferirIdToken(token: string, p: { chaves: ChavePublica[]; iss: string; aud: string; nonce: string; agora?: Date }): IdTokenConferido {
  const partes = token.split(".");
  if (partes.length !== 3) return { ok: false, erro: "formato" };
  let cab: { alg?: string; kid?: string };
  let dados: Record<string, unknown>;
  try {
    cab = JSON.parse(Buffer.from(partes[0], "base64url").toString("utf8"));
    dados = JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8"));
  } catch {
    return { ok: false, erro: "formato" };
  }
  if (cab.alg !== "RS256") return { ok: false, erro: "alg" };
  const jwk = p.chaves.find((k) => (cab.kid ? k.kid === cab.kid : true) && (k.kty === "RSA" || !k.kty));
  if (!jwk) return { ok: false, erro: "chave" };
  let assinaturaOk = false;
  try {
    const chave = createPublicKey({ key: jwk as JsonWebKey, format: "jwk" });
    assinaturaOk = verify("RSA-SHA256", Buffer.from(`${partes[0]}.${partes[1]}`), chave, Buffer.from(partes[2], "base64url"));
  } catch {
    assinaturaOk = false;
  }
  if (!assinaturaOk) return { ok: false, erro: "assinatura" };
  const agoraSeg = Math.floor((p.agora ?? new Date()).getTime() / 1000);
  if (dados.iss !== p.iss) return { ok: false, erro: "iss" };
  const aud = dados.aud;
  if (!(aud === p.aud || (Array.isArray(aud) && aud.includes(p.aud)))) return { ok: false, erro: "aud" };
  if (typeof dados.exp !== "number" || dados.exp + 60 < agoraSeg) return { ok: false, erro: "exp" };
  if (typeof dados.iat === "number" && dados.iat - 300 > agoraSeg) return { ok: false, erro: "iat" };
  if (dados.nonce !== p.nonce) return { ok: false, erro: "nonce" };
  if (typeof dados.sub !== "string" || !dados.sub) return { ok: false, erro: "sub" };
  return { ok: true, sub: dados.sub, given_name: typeof dados.given_name === "string" ? dados.given_name : "", family_name: typeof dados.family_name === "string" ? dados.family_name : "" };
}

// ── Validade e aviso ─────────────────────────────────────────────────────────────────────────────────────────────────

export function validoAte(conectadoEm: Date): Date {
  const d = new Date(conectadoEm);
  d.setUTCMonth(d.getUTCMonth() + VALIDADE_MESES);
  return d;
}

export interface LinhaConfianca {
  conectado_em: string;
  valido_ate: string;
}

export interface EstadoSelo {
  conectado: true;
  conectadoEm: string;
  validoAte: string;
}

/** O selo vale até `valido_ate`; vencido (ou sem linha) é null. */
export function estadoSelo(linha: LinhaConfianca | null | undefined, agora = new Date()): EstadoSelo | null {
  if (!linha) return null;
  if (Date.parse(linha.valido_ate) <= agora.getTime()) return null;
  return { conectado: true, conectadoEm: linha.conectado_em, validoAte: linha.valido_ate };
}

/** Aviso "Reconecte seu LinkedIn para manter o selo": a partir de 30 dias antes de vencer, uma vez só. */
export function avisoDeVencimentoDevido(linha: LinhaConfianca & { aviso_em?: string | null }, agora = new Date()): boolean {
  if (linha.aviso_em) return false;
  const vence = Date.parse(linha.valido_ate);
  return vence > agora.getTime() && vence - agora.getTime() <= AVISO_DIAS_ANTES * 86_400_000;
}

/** "Conectado em 23/10/2026" (Conta). */
export function textoConectadoEm(iso: string): string {
  const d = new Date(iso);
  return `Conectado em ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

// ── Redes de pessoas (decisão do Daniel, 23/10) ──────────────────────────────────────────────────────────────────────

/**
 * Instagram/Facebook/TikTok de PESSOAS nunca aparecem para outro usuário (nem depois do contrato). Com a chave
 * REDES_USUARIO_ATIVO desligada nem a própria pessoa vê os campos. Ligada, só a própria pessoa (e a equipe, no admin).
 */
export function redesVisiveisPara(p: { chaveLigada: boolean; quemVe: string | null; dono: string; admin?: boolean }): boolean {
  if (!p.chaveLigada) return false;
  return !!p.admin || (!!p.quemVe && p.quemVe === p.dono);
}
