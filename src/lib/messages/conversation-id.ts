import { createHash } from "node:crypto";
import { CONVERSA_NAMESPACE } from "../../config/mensagens.ts";

/**
 * Id da conversa (messages.conversation_id é UUID no banco).
 *
 * uuid v5 determinístico de (as duas pessoas, ORDENADAS) + imóvel: inquilino→dono
 * e dono→inquilino caem na MESMA conversa, e cada imóvel tem a sua. Sem imóvel
 * (ex.: conversa de Pedido antes do aceite) o sufixo é vazio — sempre igual.
 *
 * Antes o código gravava "<id>_<id>_<imóvel>" num campo uuid: o Postgres recusava
 * (22P02) e nenhuma conversa nova era aberta.
 */
export function conversationId(a: string, b: string, propertyId?: string | null): string {
  const [x, y] = [a.toLowerCase(), b.toLowerCase()].sort();
  return uuidV5(`${x}:${y}:${(propertyId ?? "").toLowerCase()}`, CONVERSA_NAMESPACE);
}

/** uuid v5 (RFC 4122): SHA-1 de namespace + nome, com versão 5 e variante RFC. */
export function uuidV5(name: string, namespace: string): string {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
  if (ns.length !== 16) throw new Error("namespace uuid inválido");
  const hash = createHash("sha1").update(ns).update(name, "utf8").digest();
  const b = hash.subarray(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
