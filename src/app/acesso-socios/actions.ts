"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  sociosToken,
  sanitizeNext,
  SOCIOS_COOKIE,
  SOCIOS_COOKIE_MAX_AGE,
  SOCIOS_UNLOCK_PATH,
} from "@/lib/socios/access";

/**
 * Desbloqueio dos sócios. Código correto → grava cookie httpOnly assinado
 * (30 dias) e libera. Código errado → atraso de 1s (anti-chute) + mensagem
 * neutra. O código vive só em `SOCIOS_ACCESS_CODE` (env) — nunca no repo.
 */
export async function entrarSocios(formData: FormData) {
  const codigo = String(formData.get("codigo") ?? "").trim();
  const next = sanitizeNext(String(formData.get("next") ?? ""));
  const esperado = process.env.SOCIOS_ACCESS_CODE ?? "";

  if (!esperado || codigo !== esperado) {
    await new Promise((r) => setTimeout(r, 1000)); // anti-chute
    redirect(`${SOCIOS_UNLOCK_PATH}?erro=1&next=${encodeURIComponent(next)}`);
  }

  const store = await cookies();
  store.set(SOCIOS_COOKIE, await sociosToken(esperado), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SOCIOS_COOKIE_MAX_AGE,
  });
  redirect(next);
}
