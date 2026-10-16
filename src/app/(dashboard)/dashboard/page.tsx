import { listMyProperties } from "@/lib/data/properties";
import { createClient } from "@/lib/supabase/server";
import { contarInteressados } from "@/lib/painel/kpi-interessados";
import { VisaoGeral } from "./visao-geral-client";

/**
 * Datas das candidaturas recebidas nos últimos 60 dias (30 atuais + 30 de
 * comparação). RLS: o dono só lê os próprios leads; sem sessão/erro → zero.
 */
async function interessadosDoDono(): Promise<{ atual: number; anterior: number }> {
  const supabase = await createClient();
  if (!supabase) return { atual: 0, anterior: 0 };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { atual: 0, anterior: 0 };
  const desde = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("leads")
    .select("created_at")
    .eq("owner_id", user.id)
    .gte("created_at", desde);
  return contarInteressados((data ?? []).map((l: { created_at: string | null }) => l.created_at));
}

/**
 * Visão geral. Os imóveis do proprietário vêm do SERVIDOR pela MESMA consulta
 * de "Meus imóveis" (listMyProperties) — sem o vazio enquanto o navegador
 * buscava a lista, que fazia a tela dizer "ainda não publicou" com imóvel
 * ativo (F31).
 */
export default async function DashboardPage() {
  const interessadosPromessa = interessadosDoDono();
  const imoveisDono = await listMyProperties();
  const interessados = await interessadosPromessa;
  return <VisaoGeral imoveisDono={imoveisDono} interessados={interessados} />;
}
