import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PROPERTY_PUBLIC_COLUMNS } from "@/lib/data/properties";
import {
  COLUNAS_EXPORT_AVALIACOES,
  COLUNAS_EXPORT_CONTRATOS,
  COLUNAS_EXPORT_LEADS,
  NOME_ARQUIVO_DADOS,
  limparLinha,
  normalizarPrivacidade,
} from "@/lib/conta/tela-privacidade";

/**
 * GET /api/conta/meus-dados — "Baixar meus dados" (A5, mockup perfil-05): um arquivo JSON com os dados da PRÓPRIA
 * pessoa. Tudo lido com o cliente da sessão: a RLS garante que só saem linhas dela. Sem colunas de credencial
 * (limparLinha), sem cache e sem registro do conteúdo em log.
 */
export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Indisponível." }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });

  const linhas = async (q: PromiseLike<{ data: unknown; error: unknown }>) => {
    const { data, error } = await q;
    if (error || !Array.isArray(data)) return [];
    return (data as Record<string, unknown>[]).map((l) => limparLinha(l));
  };
  const { data: perfil } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const imoveis = await linhas(supabase.from("properties").select(PROPERTY_PUBLIC_COLUMNS).eq("owner_id", user.id));
  const idsImoveis = imoveis.map((i) => i?.id).filter((v): v is string => typeof v === "string");
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;

  const arquivo = {
    geradoEm: new Date().toISOString(),
    conta: { id: user.id, email: user.email ?? null, criadaEm: user.created_at, emailConfirmado: !!user.email_confirmed_at },
    perfil: limparLinha(perfil as Record<string, unknown> | null),
    preferencias: {
      dataNascimento: typeof meta.data_nascimento === "string" ? meta.data_nascimento : null,
      notificacaoNoCelular: meta.notif_push !== false,
      privacidade: normalizarPrivacidade(meta.privacidade),
    },
    chavePixParaReceber: await linhas(supabase.from("recebimento_pix").select("*").eq("user_id", user.id)),
    imoveis,
    pedidosDeMoradia: await linhas(supabase.from("pedidos_moradia").select("*").eq("inquilino_id", user.id)),
    candidaturasEnviadas: await linhas(supabase.from("leads").select(COLUNAS_EXPORT_LEADS).eq("tenant_id", user.id)),
    contratosComoMorador: await linhas(supabase.from("contratos").select(COLUNAS_EXPORT_CONTRATOS).eq("tenant_id", user.id)),
    contratosComoProprietario: idsImoveis.length ? await linhas(supabase.from("contratos").select(COLUNAS_EXPORT_CONTRATOS).in("property_id", idsImoveis)) : [],
    // Só as publicadas (avaliação às cegas: a recebida aparece quando as duas partes enviaram ou o prazo venceu).
    avaliacoesRecebidas: await linhas(supabase.from("avaliacoes").select(COLUNAS_EXPORT_AVALIACOES).eq("alvo_id", user.id).not("publicada_em", "is", null)),
    avaliacoesEscritas: await linhas(supabase.from("avaliacoes").select(COLUNAS_EXPORT_AVALIACOES).eq("autor_id", user.id)),
  };

  return new NextResponse(JSON.stringify(arquivo, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${NOME_ARQUIVO_DADOS}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
