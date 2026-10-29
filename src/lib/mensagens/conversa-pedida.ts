/*
  E200 — o botão "Mensagem" (página da estadia) abre /dashboard/mensagens?conversa=<id>. O id é determinístico
  (conversationId das duas pessoas + imóvel), mas a conversa só existe na lista quando já há mensagem gravada. Contrato
  sem nenhuma mensagem entre as partes (ex.: VN-CT-D5D50247, montado direto no banco) gerava um link para uma conversa
  que não estava na lista, e a tela abria a PRIMEIRA conversa da lista — de outro morador.
  Regra: a lista da pessoa já traz a conversa de cada contrato em que ela é parte (vazia, pronta para a primeira
  mensagem); a conversa pedida só abre se está na lista. Fora disso: "não encontrada". Nunca a conversa de outra pessoa.
  PURO. Roda: node --test src/lib/mensagens/conversa-pedida.test.ts
*/

export interface ContratoParaConversa {
  id: string;
  tenantId: string;
  ownerId: string;
  propertyId: string;
  titulo: string;
}

export interface ConversaDeContrato {
  id: string;
  contrato: ContratoParaConversa;
  outroId: string;
  papel: "proprietario" | "inquilino";
}

/**
  E200 (QA 28/10): toda conversa de estadia entra na lista desde a criação do contrato, mesmo sem mensagem — antes ela
  só aparecia quando o link da estadia a injetava, e com o nome fixo "Morador". Devolve as conversas dos contratos em
  que a pessoa é parte e que ainda não estão na lista (uma por id: renovação no mesmo imóvel é a mesma conversa).
*/
export function conversasDeContratos(
  idsDaLista: readonly string[],
  contratos: readonly ContratoParaConversa[],
  userId: string,
  idDe: (a: string, b: string, propertyId: string) => string,
): ConversaDeContrato[] {
  const vistos = new Set(idsDaLista);
  const novas: ConversaDeContrato[] = [];
  for (const c of contratos) {
    const souDono = c.ownerId === userId;
    if ((!souDono && c.tenantId !== userId) || c.tenantId === c.ownerId) continue;
    const id = idDe(c.tenantId, c.ownerId, c.propertyId);
    if (vistos.has(id)) continue;
    vistos.add(id);
    novas.push({ id, contrato: c, outroId: souDono ? c.tenantId : c.ownerId, papel: souDono ? "proprietario" : "inquilino" });
  }
  return novas;
}

/** Qual conversa a tela abre ao carregar: a pedida (se está na lista), nenhuma (se foi pedida e não existe) ou a 1ª. */
export function conversaInicial(pedida: string | null | undefined, idsDaLista: readonly string[]): string | null {
  if (pedida) return idsDaLista.includes(pedida) ? pedida : null;
  return idsDaLista[0] ?? null;
}

export const TEXTO_CONVERSA_NAO_ENCONTRADA = "Esta conversa não está na sua lista. Escolha uma conversa abaixo.";
export const TEXTO_CONVERSA_NOVA = "Nenhuma mensagem ainda. Escreva a primeira.";
