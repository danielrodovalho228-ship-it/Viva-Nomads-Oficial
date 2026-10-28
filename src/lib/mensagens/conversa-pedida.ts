/*
  E200 — o botão "Mensagem" (página da estadia) abre /dashboard/mensagens?conversa=<id>. O id é determinístico
  (conversationId das duas pessoas + imóvel), mas a conversa só existe na lista quando já há mensagem gravada. Contrato
  sem nenhuma mensagem entre as partes (ex.: VN-CT-D5D50247, montado direto no banco) gerava um link para uma conversa
  que não estava na lista, e a tela abria a PRIMEIRA conversa da lista — de outro morador.
  Regra: a conversa pedida só abre se está na lista da pessoa OU se é a conversa de um contrato em que ela é parte
  (aí abre vazia, pronta para a primeira mensagem). Fora disso: "não encontrada". Nunca a conversa de outra pessoa.
  PURO. Roda: node --test src/lib/mensagens/conversa-pedida.test.ts
*/

export interface ContratoParaConversa {
  id: string;
  tenantId: string;
  ownerId: string;
  propertyId: string;
  titulo: string;
}

export type ConversaPedida =
  | { tipo: "nenhuma" }
  | { tipo: "existe" }
  | { tipo: "nova"; contrato: ContratoParaConversa; outroId: string; papel: "proprietario" | "inquilino" }
  | { tipo: "nao_encontrada" };

export function resolverConversaPedida(
  pedida: string | undefined,
  idsDaLista: readonly string[],
  contratos: readonly ContratoParaConversa[],
  userId: string,
  idDe: (a: string, b: string, propertyId: string) => string,
): ConversaPedida {
  if (!pedida) return { tipo: "nenhuma" };
  if (idsDaLista.includes(pedida)) return { tipo: "existe" };
  for (const c of contratos) {
    const souDono = c.ownerId === userId;
    if (!souDono && c.tenantId !== userId) continue;
    if (idDe(c.tenantId, c.ownerId, c.propertyId) !== pedida) continue;
    return { tipo: "nova", contrato: c, outroId: souDono ? c.tenantId : c.ownerId, papel: souDono ? "proprietario" : "inquilino" };
  }
  return { tipo: "nao_encontrada" };
}

/** Qual conversa a tela abre ao carregar: a pedida (se está na lista), nenhuma (se foi pedida e não existe) ou a 1ª. */
export function conversaInicial(pedida: string | null | undefined, idsDaLista: readonly string[]): string | null {
  if (pedida) return idsDaLista.includes(pedida) ? pedida : null;
  return idsDaLista[0] ?? null;
}

export const TEXTO_CONVERSA_NAO_ENCONTRADA = "Esta conversa não está na sua lista. Escolha uma conversa abaixo.";
export const TEXTO_CONVERSA_NOVA = "Nenhuma mensagem ainda. Escreva a primeira.";
