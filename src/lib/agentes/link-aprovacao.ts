/*
  Link de aprovação de USO ÚNICO (ordem 12a8086d, item 4). PURO: sem banco, sem rede.
  O e-mail/push do Moacir leva um link assinado (avisos-daniel.ts, 72 h). Esse link NÃO aprova nada:
  só abre a aba Aprovações, e só para admin com as duas etapas feitas. A tela /admin/agentes/aprovar
  confere assinatura e prazo e grava a assinatura em public.aprovacoes_links_usados (0340): a segunda
  abertura do mesmo link é recusada. Abertura sem login (ex.: leitor de links do e-mail) não consome.
  Roda: node --test src/lib/agentes/link-aprovacao.test.ts
*/
import { linkValido } from "./avisos-daniel.ts";

export const ROTA_LINK_APROVAR = "/admin/agentes/aprovar";

export interface LinkAprovacao {
  ronda: string;
  /** Prazo em segundos (epoch), como vem no parâmetro `e`. */
  expira: number;
  /** 32 caracteres hex (HMAC truncado). */
  assinatura: string;
}

type Parametros = Record<string, string | string[] | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lê r/e/s da URL. Qualquer coisa fora do formato vira null (nada de exceção). */
export function lerLinkAprovacao(sp: Parametros): LinkAprovacao | null {
  const { r, e, s } = sp;
  if (typeof r !== "string" || typeof e !== "string" || typeof s !== "string") return null;
  if (!UUID.test(r) || !/^\d{9,11}$/.test(e) || !/^[0-9a-f]{32}$/.test(s)) return null;
  return { ronda: r.toLowerCase(), expira: Number(e), assinatura: s };
}

export type ConferenciaLink = "valido" | "expirado" | "invalido";

/** Assinatura certa e no prazo → "valido". Assinatura certa fora do prazo → "expirado". O resto → "invalido". */
export function conferirLinkAprovacao(l: LinkAprovacao | null, agora: Date, segredo: string): ConferenciaLink {
  if (!l || !segredo) return "invalido";
  if (linkValido(l.ronda, l.expira, l.assinatura, agora, segredo)) return "valido";
  // Mesma assinatura conferida no último segundo do prazo: se bate, o link é legítimo mas venceu.
  return linkValido(l.ronda, l.expira, l.assinatura, new Date(l.expira * 1000 - 1000), segredo) ? "expirado" : "invalido";
}

/** Acesso mínimo ao banco (o servidor passa o cliente de serviço; o teste passa um falso). */
export interface BancoLinks {
  /** insert em aprovacoes_links_usados; `codigo` = código do Postgres do erro (23505 = já existe) ou null. */
  inserir(assinatura: string, expiraEm: string): Promise<{ codigo: string | null }>;
  /** Apaga linhas de links já vencidos (não servem mais para nada). Best-effort. */
  limparVencidos(): Promise<void>;
}

export type Consumo = "ok" | "usado" | "erro";

/** Marca o link como usado. A chave primária garante o "uma vez só" mesmo com dois cliques ao mesmo tempo. Falha fechada. */
export async function consumirLinkAprovacao(b: BancoLinks, l: LinkAprovacao): Promise<Consumo> {
  try {
    const { codigo } = await b.inserir(l.assinatura, new Date(l.expira * 1000).toISOString());
    if (codigo === "23505") return "usado";
    if (codigo) return "erro";
  } catch {
    return "erro";
  }
  await b.limparVencidos().catch(() => undefined);
  return "ok";
}

export const MENSAGEM_LINK = {
  usado: "Este link já foi usado. Por segurança, cada link de aviso abre a tela uma vez só. Os pedidos continuam na aba Aprovações.",
  expirado: "Este link venceu (vale 72 h). Os pedidos que ainda esperam seu OK continuam na aba Aprovações.",
  invalido: "Este link não é válido. Abra a aba Aprovações pela Central.",
  erro: "Não deu para conferir o link agora. Tente de novo em instantes ou abra a aba Aprovações pela Central.",
} as const;
