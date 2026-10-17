"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { conferirDesligarAlerta } from "@/lib/busca/alerta-busca";

/** Desliga o alerta de UMA busca pelo link assinado do e-mail (confere a assinatura no servidor). */
export async function desligarAlertaPorLink(formData: FormData): Promise<void> {
  const b = String(formData.get("b") ?? "");
  const t = String(formData.get("t") ?? "");
  if (!conferirDesligarAlerta(b, t, process.env.CRON_SECRET ?? "")) redirect("/alerta-busca/desligar");
  const admin = createAdminClient();
  if (admin) await admin.from("buscas_salvas").update({ alerta_ativo: false }).eq("id", b);
  redirect("/alerta-busca/desligar?ok=1");
}
