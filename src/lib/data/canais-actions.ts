"use server";

import { createClient } from "@/lib/supabase/server";
import { erroBancoPT } from "@/lib/erros-banco";
import { canaisComDado, canaisPadrao, normalizarCanais, type CanaisAviso } from "@/lib/conta/tela-notificacoes";

/*
  A6 — Conta › Notificações (mockup perfil-06), bloco "Canais": a PREFERÊNCIA de cada canal, gravada pela sessão.
    • E-mail → profiles.notif_email; WhatsApp → profiles.notif_whatsapp (já existiam, 0028).
    • Notificação no celular (push) → user_metadata.notif_push (sem migração: a própria pessoa grava nos dados da conta).
  Isto não liga envio nenhum: WhatsApp só sai com o número oficial configurado e o push só com o app e as chaves — as
  mesmas travas de antes (decisão de 24/10: as preferências seguem o mockup; o envio segue atrás das chaves).
  Desligar, sim, vale: com notif_push = false nenhum push sai para a pessoa (sendPushParaUsuarios, push.ts).
*/

export async function getCanais(): Promise<CanaisAviso & { temCelular: boolean }> {
  const supabase = await createClient();
  if (!supabase) return { ...canaisPadrao(), temCelular: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...canaisPadrao(), temCelular: true };
  // Achado 53: a falha de leitura LANÇA — antes a tela abria com os três canais ligados e "Salvar" gravava isso.
  const { data, error } = await supabase.from("profiles").select("notif_email, notif_whatsapp, phone").eq("id", user.id).maybeSingle();
  if (error) throw new Error("Não foi possível ler seus canais de aviso agora.");
  // E703: sem celular cadastrado o WhatsApp nasce desligado (e indisponível na tela), mesmo com a preferência gravada ligada.
  const temCelular = String((data as { phone?: unknown } | null)?.phone ?? "").replace(/\D/g, "").length >= 10;
  const lidos = normalizarCanais({
    email: (data as { notif_email?: unknown } | null)?.notif_email,
    whatsapp: (data as { notif_whatsapp?: unknown } | null)?.notif_whatsapp,
    push: (user.user_metadata as { notif_push?: unknown } | undefined)?.notif_push,
  });
  return { ...canaisComDado(lidos, { temCelular }), temCelular };
}

export async function setCanais(bruto: unknown): Promise<{ ok: boolean; demo?: boolean; error?: string }> {
  const c = bruto as Partial<CanaisAviso> | null;
  if (!c || typeof c.email !== "boolean" || typeof c.whatsapp !== "boolean" || typeof c.push !== "boolean") return { ok: false, error: "Valor inválido." };
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para alterar preferências." };
  // E703: nunca grava "WhatsApp ligado" para quem não tem celular cadastrado.
  const { data: perfil, error: erroPerfil } = await supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle();
  if (erroPerfil) return { ok: false, error: "Não foi possível salvar agora. Tente de novo." };
  const temCelular = String((perfil as { phone?: unknown } | null)?.phone ?? "").replace(/\D/g, "").length >= 10;
  const { error } = await supabase.from("profiles").update({ notif_email: c.email, notif_whatsapp: c.whatsapp && temCelular }).eq("id", user.id);
  if (error) return { ok: false, error: erroBancoPT(error) };
  const { error: e2 } = await supabase.auth.updateUser({ data: { notif_push: c.push } });
  if (e2) return { ok: false, error: "Não foi possível salvar agora. Tente de novo." };
  return { ok: true };
}
