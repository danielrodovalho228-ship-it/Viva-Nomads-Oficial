/*
  63-B (decisão do Daniel, 23/10) — Instagram/Facebook/TikTok da PRÓPRIA pessoa: opcionais, só https e do domínio certo
  (a mesma validação de domínio das redes dos parceiros, Prompt 31). PRIVADOS: nunca aparecem para outro usuário.
*/
import { validarRede } from "../parceiros/regras.ts";

export type RedePessoal = "instagram" | "facebook" | "tiktok";

export function validarRedePessoal(rede: RedePessoal, bruto: string | null | undefined): { ok: true; valor: string | null } | { ok: false; erro: string } {
  const v = validarRede(rede, bruto);
  if (!v.ok || v.valor === null) return v;
  if (!v.valor.startsWith("https://")) return { ok: false, erro: "Use um endereço que comece com https://." };
  if (v.valor.length > 200) return { ok: false, erro: "Endereço longo demais." };
  return v;
}
