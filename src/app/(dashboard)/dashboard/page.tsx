import { listMyProperties } from "@/lib/data/properties";
import { createClient } from "@/lib/supabase/server";
import { contarInteressados } from "@/lib/painel/kpi-interessados";
import { listarPropostas } from "@/lib/data/propostas-actions";
import { VisaoGeral, type PropostaAguardando } from "./visao-geral-client";

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

/** Cidade do perfil público (Prompt 31a: a seção "Serviços" abre a busca de parceiros já com ela). */
async function cidadeDoPerfil(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("cidade").eq("id", user.id).maybeSingle();
  return ((data?.cidade as string | null) ?? "").trim() || null;
}

/**
 * Visão geral. Os imóveis do proprietário vêm do SERVIDOR pela MESMA consulta
 * de "Meus imóveis" (listMyProperties) — sem o vazio enquanto o navegador
 * buscava a lista, que fazia a tela dizer "ainda não publicou" com imóvel
 * ativo (F31).
 */
export default async function DashboardPage() {
  const interessadosPromessa = interessadosDoDono();
  // Propostas esperando a resposta do inquilino (prompt 27): cartão "vence em N dias" na Visão geral.
  const propostasPromessa = listarPropostas().catch(() => []);
  const imoveisDono = await listMyProperties();
  const cidadePerfil = await cidadeDoPerfil();
  const interessados = await interessadosPromessa;
  const propostas: PropostaAguardando[] = (await propostasPromessa)
    .filter((p) => p.papel === "tenant" && p.aguardandoVoce)
    .sort((a, b) => a.validaAte.localeCompare(b.validaAte))
    .map((p) => ({ id: p.id, numero: p.numero, imovel: p.imovel, validaAte: p.validaAte }));
  return <VisaoGeral imoveisDono={imoveisDono} interessados={interessados} propostasAguardando={propostas} cidadePerfil={cidadePerfil} />;
}
