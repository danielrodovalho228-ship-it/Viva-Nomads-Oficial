"use server";

import { createClient } from "@/lib/supabase/server";
import { guardContactInfo } from "@/lib/messages/contact-guard";

type ActionResult = { ok: boolean; demo?: boolean; error?: string };

function brDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

/**
 * Solicitação de RESERVA pelo inquilino: abre a conversa interna com o
 * proprietário já com as datas escolhidas (check-in/out). Reusa a tabela
 * `messages` (mesma convenção de conversation_id do fluxo de candidatura) — sem
 * mover dinheiro e sem tabela nova. Best-effort: no-op em demo/sem sessão.
 */
export async function solicitarReserva(
  propertyId: string,
  checkIn: string,
  checkOut: string
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para solicitar a reserva." };

  const { data: imovel } = await supabase
    .from("properties")
    .select("owner_id")
    .eq("id", propertyId)
    .maybeSingle();
  const ownerId = imovel?.owner_id as string | undefined;
  if (!ownerId) return { ok: false, error: "Imóvel não encontrado." };
  if (ownerId === user.id) return { ok: false, error: "Este imóvel é seu." };

  const conversationId = [user.id, ownerId].sort().join("_") + `_${propertyId}`;
  const body = guardContactInfo(
    `Tenho interesse em reservar de ${brDate(checkIn)} a ${brDate(checkOut)}. Podemos conversar pela plataforma?`
  ).text;

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    receiver_id: ownerId,
    property_id: propertyId,
    body,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
