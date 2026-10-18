import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { GERACAO_IA_ATIVA } from "@/lib/flags";
import { consumirLimite, ipHash, DIA } from "@/lib/limites";
import { integracoesSimuladas, registrarSimulado } from "@/lib/integracoes";
import { IA_LIMITE_DIA } from "@/lib/ai/anuncio-prompt";
import {
  validarMiniaturas,
  sanearSugestao,
  FOTOS_SYSTEM_PROMPT,
  FOTOS_OUTPUT_SCHEMA,
  FOTOS_MAX_CORPO,
  SUGESTAO_LAB_BRUTA,
} from "@/lib/ai/fotos-prompt";

/**
 * "Preencher com IA" a partir das fotos (ordem 721a139a, parte B).
 *
 * Mesmas travas da rota /api/ai/anuncio: flag GERACAO_IA_ATIVA + chave só no
 * servidor, login de proprietário/admin, limite diário por pessoa e por IP
 * (contado ANTES de chamar o modelo; divide a cota com a geração de texto).
 * O cliente manda só miniaturas JPEG em base64 (sem EXIF, sem URL — o servidor
 * não busca nada e não grava nada); nenhum dado pessoal vai junto. A saída é
 * sanitizada (enum, faixas, chaves do catálogo, sem contato) antes de voltar.
 *
 * Cadastro em 5 etapas (prompt 10): a tela chama esta rota sozinha ao terminar o envio das fotos (uma vez por
 * rascunho). Sem chave ou com a flag desligada responde 503 e a etapa segue sem sugestões. No laboratório
 * (INTEGRACOES_SIMULADAS=on) devolve SEMPRE a mesma resposta fixa, sem chamar a API.
 */
export async function POST(request: Request) {
  const simulado = integracoesSimuladas();
  if (!simulado && (!GERACAO_IA_ATIVA || !process.env.ANTHROPIC_API_KEY)) {
    return NextResponse.json({ error: "A geração por IA está desativada no momento." }, { status: 503 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Indisponível." }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: perfil } = await supabase
    .from("profiles")
    .select("role, preferred_mode")
    .eq("id", user.id)
    .maybeSingle();
  const podeAnunciar =
    perfil?.role === "owner" || perfil?.role === "admin" || perfil?.preferred_mode === "owner";
  if (!podeAnunciar) return NextResponse.json({ error: "Disponível para proprietários." }, { status: 403 });

  const cru = await request.text().catch(() => "");
  if (cru.length > FOTOS_MAX_CORPO) {
    return NextResponse.json({ error: "Fotos demais para analisar de uma vez." }, { status: 413 });
  }
  let miniaturas: string[];
  try {
    const parsed: unknown = JSON.parse(cru || "{}");
    const v = validarMiniaturas(
      parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>).miniaturas : undefined,
    );
    if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 });
    miniaturas = v.miniaturas;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const okPessoa = await consumirLimite(`ia:user:${user.id}`, IA_LIMITE_DIA, DIA);
  const okIp = okPessoa && (await consumirLimite(`ia:ip:${ipHash(request)}`, IA_LIMITE_DIA * 3, DIA));
  if (!okPessoa || !okIp) {
    return NextResponse.json(
      { error: `Limite de ${IA_LIMITE_DIA} gerações por dia atingido. Tente novamente amanhã.` },
      { status: 429 },
    );
  }

  if (simulado) {
    await registrarSimulado("ia", { acao: "fotos", fotos: miniaturas.length });
    const lab = sanearSugestao(SUGESTAO_LAB_BRUTA);
    return lab.ok ? NextResponse.json(lab.sugestao) : NextResponse.json({ error: "Indisponível." }, { status: 503 });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system: FOTOS_SYSTEM_PROMPT,
      output_config: { effort: "low", format: { type: "json_schema", schema: FOTOS_OUTPUT_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            ...miniaturas.map((data) => ({
              type: "image" as const,
              source: { type: "base64" as const, media_type: "image/jpeg" as const, data },
            })),
            { type: "text" as const, text: "Sugira o preenchimento do cadastro a partir destas fotos, seguindo as regras." },
          ],
        },
      ],
    });

    const bloco = res.content.find((b) => b.type === "text");
    let saneada: ReturnType<typeof sanearSugestao>;
    try {
      saneada = sanearSugestao(JSON.parse(bloco && bloco.type === "text" ? bloco.text : ""));
    } catch {
      return NextResponse.json({ error: "Não foi possível analisar agora. Tente de novo." }, { status: 502 });
    }
    if (!saneada.ok) {
      return saneada.motivo === "nao_imovel"
        ? NextResponse.json(
            { error: "Estas fotos não parecem ser de um imóvel. Envie fotos dos ambientes." },
            { status: 422 },
          )
        : NextResponse.json({ error: "Não foi possível analisar agora. Tente de novo." }, { status: 502 });
    }

    await supabase.from("ai_generations").insert({ user_id: user.id, kind: "anuncio" });
    return NextResponse.json(saneada.sugestao);
  } catch {
    return NextResponse.json({ error: "A geração por IA está indisponível agora." }, { status: 503 });
  }
}
