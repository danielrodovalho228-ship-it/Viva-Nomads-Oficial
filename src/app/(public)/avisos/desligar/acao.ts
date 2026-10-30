"use server";

import { redirect } from "next/navigation";
import { desligarSugestoesPorLink } from "@/lib/data/descadastro-servidor";

/** Confirmação da página: desliga "Sugestões e novidades" pelo link assinado do e-mail (sem login). */
export async function desligarSugestoes(formData: FormData): Promise<void> {
  const u = String(formData.get("u") ?? "");
  const t = String(formData.get("t") ?? "");
  if (!(await desligarSugestoesPorLink(u, t))) redirect("/avisos/desligar");
  redirect("/avisos/desligar?ok=1");
}
