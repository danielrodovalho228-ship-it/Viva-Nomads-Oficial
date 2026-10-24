import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { diaBRT } from "@/lib/datas-brasilia";
import { fotosPorDia } from "./deteccao";
import { deteccaoAtiva } from "./deteccao-chave";

/** Contador do admin (DETECTA-B): fotos analisadas por dia nos últimos 7 dias e se a chave está ligada. */
export async function resumoDeteccaoAdmin(): Promise<{ ligada: boolean; porDia: { dia: string; fotos: number }[] } | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const desde = new Date(Date.now() - 8 * 86_400_000).toISOString();
  const { data, error } = await admin.from("deteccao_fotos_analises").select("analisada_em").gte("analisada_em", desde).limit(20_000);
  if (error) return null;
  const hoje = diaBRT(new Date())!;
  return { ligada: await deteccaoAtiva(), porDia: fotosPorDia(((data ?? []) as { analisada_em: string }[]).map((r) => diaBRT(r.analisada_em)), hoje) };
}
