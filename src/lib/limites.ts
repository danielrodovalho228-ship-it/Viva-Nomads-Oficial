import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Limite de uso por chave (usuário/IP), no banco (0056: consumir_limite, só o
 * servidor executa). Falha FECHADA: sem service role, sem a migração ou com
 * erro, devolve false — rota paga não roda sem limite.
 */
export async function consumirLimite(chave: string, maximo: number, janelaSegundos: number): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { data, error } = await admin.rpc("consumir_limite", {
    chave,
    maximo,
    janela_segundos: janelaSegundos,
  });
  if (error) {
    console.error("[limites] indisponível:", error.message);
    return false;
  }
  return data === true;
}

/** IP do pedido (primeiro do x-forwarded-for), como HASH — nunca o IP cru. */
export function ipHash(request: Request): string {
  const ip =
    (request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "").trim() ||
    "desconhecido";
  const segredo = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "viva-nomads";
  return crypto.createHmac("sha256", segredo).update(`ip:${ip}`).digest("hex").slice(0, 32);
}

export const DIA = 24 * 60 * 60;
export const HORA = 60 * 60;
