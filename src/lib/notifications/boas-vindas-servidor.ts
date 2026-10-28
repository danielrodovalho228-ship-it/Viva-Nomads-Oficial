import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notify } from "@/lib/notifications";
import { boasVindas, detalhes, perfilDasBoasVindas } from "./emails-e205b";

/*
  E205-B (a) — boas-vindas: UMA vez por conta, na primeira entrada (a tela de intenção, que só a conta nova vê e que
  vem depois do código: o e-mail já está confirmado). Não é o e-mail de confirmação do Supabase. O "uma vez" é a
  chave em automacoes_envios (sem migração): grava primeiro; se já existia, não envia.
*/

export const CHAVE_BOAS_VINDAS = (usuarioId: string) => `boas_vindas:${usuarioId}`;

export async function enviarBoasVindas(admin: SupabaseClient, usuarioId: string, intencao: readonly string[], modo: "owner" | "tenant" | null): Promise<boolean> {
  try {
    const { data: p } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", usuarioId).maybeSingle();
    const perfil = p as { email: string | null; full_name: string | null; notif_email: boolean | null } | null;
    if (!perfil?.email || perfil.notif_email === false) return false;
    const { error } = await admin.from("automacoes_envios").insert({ chave: CHAVE_BOAS_VINDAS(usuarioId), tipo: "boas_vindas", usuario_id: usuarioId });
    if (error) return false; // já enviado (ou sem como garantir o "uma vez": melhor não enviar)
    const e = boasVindas(perfilDasBoasVindas(intencao, modo));
    const d = detalhes({ titulo: e.titulo, passos: e.passos, rodape: e.rodape });
    await notify({
      event: "boas_vindas",
      email: perfil.email,
      name: perfil.full_name ?? undefined,
      userId: usuarioId,
      pushUrl: e.url,
      subject: e.assunto,
      body: e.abertura,
      ctaLabel: e.cta,
      detailsHtml: d.html,
      detailsText: d.texto,
      semPush: true,
    });
    return true;
  } catch {
    return false; // aviso é complemento: nunca quebra a entrada
  }
}
