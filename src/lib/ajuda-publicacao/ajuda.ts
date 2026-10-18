/*
  Ordem 65e999b2 (Próximo do FF 4/6) — "Publicamos para você".
  O dono envia o link e/ou o texto do anúncio que já tem; a equipe monta o rascunho numa fila do /admin
  e o DONO aprova antes de publicar (publicar continua exigindo documento aprovado). Sem custo nesta fase.
  Funções puras: validação da entrada, rótulos e transições de status. Sem rede.
*/

export const STATUS_AJUDA = ["recebido", "em_montagem", "enviado_dono", "aprovado_dono", "ajustes_pedidos", "cancelado"] as const;
export type StatusAjuda = (typeof STATUS_AJUDA)[number];

export const ROTULO_STATUS: Record<StatusAjuda, string> = {
  recebido: "Recebido",
  em_montagem: "Em montagem",
  enviado_dono: "Enviado para a sua aprovação",
  aprovado_dono: "Aprovado por você",
  ajustes_pedidos: "Ajustes pedidos por você",
  cancelado: "Cancelado",
};

export const LIMITE_LINK = 500;
export const LIMITE_TEXTO = 6000;
export const LIMITE_OBSERVACAO = 500;
export const MAX_ABERTOS_POR_DONO = 3;
export const MAX_FOTOS_AJUDA = 8;

export const AVISO_SEM_CUSTO = "Sem custo nesta fase. A equipe monta o rascunho e você aprova antes de publicar.";
export const AVISO_APROVACAO =
  "Nada vai ao ar sem a sua aprovação, e publicar continua exigindo o documento do imóvel aprovado.";

/** Próximos passos permitidos para a equipe (a decisão sobre o rascunho enviado é só do dono). */
const PROXIMOS: Record<StatusAjuda, StatusAjuda[]> = {
  recebido: ["em_montagem", "cancelado"],
  em_montagem: ["enviado_dono", "cancelado"],
  enviado_dono: [],
  aprovado_dono: [],
  ajustes_pedidos: ["em_montagem", "cancelado"],
  cancelado: [],
};

/** O dono decide sobre o rascunho montado: aprova ou pede ajustes. Só vale quando está "enviado_dono". */
export const DECISOES_DONO = ["aprovado_dono", "ajustes_pedidos"] as const;
export type DecisaoDono = (typeof DECISOES_DONO)[number];

export function ehDecisaoDono(v: unknown): v is DecisaoDono {
  return typeof v === "string" && (DECISOES_DONO as readonly string[]).includes(v);
}

export function donoPodeDecidir(atual: StatusAjuda): boolean {
  return atual === "enviado_dono";
}

export function ehStatusAjuda(v: unknown): v is StatusAjuda {
  return typeof v === "string" && (STATUS_AJUDA as readonly string[]).includes(v);
}

export function proximosStatus(atual: StatusAjuda): StatusAjuda[] {
  return PROXIMOS[atual];
}

export function transicaoValida(de: StatusAjuda, para: StatusAjuda): boolean {
  return PROXIMOS[de].includes(para);
}

/** Pedido ainda em andamento (conta para o limite por dono). */
export function estaAberto(status: StatusAjuda): boolean {
  return status === "recebido" || status === "em_montagem" || status === "ajustes_pedidos";
}

export type EntradaAjuda = { link?: string | null; texto?: string | null; observacao?: string | null; fotos?: string[] | null };
export type AjudaValida = { link: string | null; texto: string | null; observacao: string | null; fotos: string[] };

/** Caminho que /api/upload/foto devolve: <uid do dono>/<uuid>.jpg|png|webp. Pasta de outro dono é recusada. */
export function fotoDoDono(path: unknown, donoId: string): path is string {
  return (
    typeof path === "string" &&
    path.startsWith(`${donoId}/`) &&
    /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(path)
  );
}

function limpar(v: string | null | undefined): string | null {
  const t = (v ?? "").replace(/\r\n/g, "\n").trim();
  return t ? t : null;
}

/** Só http(s); sem credenciais na URL. Devolve a URL normalizada ou null. */
export function linkValido(bruto: string): string | null {
  try {
    const u = new URL(bruto.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function validarPedidoAjuda(e: EntradaAjuda, donoId = ""): { ok: true; valor: AjudaValida } | { ok: false; erro: string } {
  const linkBruto = limpar(e.link);
  const texto = limpar(e.texto);
  const observacao = limpar(e.observacao);
  let link: string | null = null;
  if (linkBruto) {
    link = linkValido(linkBruto);
    if (!link) return { ok: false, erro: "O link precisa começar com https:// e ser de uma página do seu anúncio." };
    if (link.length > LIMITE_LINK) return { ok: false, erro: `O link passa de ${LIMITE_LINK} caracteres.` };
  }
  const brutas = Array.isArray(e.fotos) ? e.fotos : [];
  const fotos = [...new Set(brutas)];
  if (fotos.length > MAX_FOTOS_AJUDA) return { ok: false, erro: `Envie no máximo ${MAX_FOTOS_AJUDA} fotos.` };
  if (!fotos.every((f) => fotoDoDono(f, donoId))) return { ok: false, erro: "Uma das fotos não é válida. Envie de novo." };
  if (!link && !texto && fotos.length === 0) return { ok: false, erro: "Envie o link, o texto ou as fotos do anúncio que você já tem." };
  if (texto && texto.length < 10) return { ok: false, erro: "O texto do anúncio está curto demais." };
  if (texto && texto.length > LIMITE_TEXTO) return { ok: false, erro: `O texto passa de ${LIMITE_TEXTO} caracteres.` };
  if (observacao && observacao.length > LIMITE_OBSERVACAO) return { ok: false, erro: `A observação passa de ${LIMITE_OBSERVACAO} caracteres.` };
  return { ok: true, valor: { link, texto, observacao, fotos } };
}
