import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { GERACAO_IA_ATIVA } from "@/lib/flags";
import {
  montarBrief,
  limparSaida,
  contemContato,
  IA_SYSTEM_PROMPT,
  IA_OUTPUT_SCHEMA,
  IA_LIMITE_DIA,
  type AnuncioBriefInput,
} from "@/lib/ai/anuncio-prompt";

/**
 * Geração de TÍTULO e DESCRIÇÃO do anúncio por IA (item QA do editor).
 *
 * Segurança: a chave da API (ANTHROPIC_API_KEY) vive SÓ no servidor — nunca é
 * exposta ao cliente. A rota é gated por flag (GERACAO_IA_ATIVA) e por chave
 * presente; sem qualquer uma delas, responde 503 sem chamar o provedor. Rate
 * limit de 10/dia por proprietário (migration 0045). Só campos SEGUROS do
 * imóvel vão ao modelo (allowlist em montarBrief — nada de endereço/contato/PII),
 * e a saída passa por um guarda-corpo que remove contato que porventura escape.
 */
export async function POST(request: Request) {
  // Portão duplo: flag ligada E chave presente. Sem isso, feature dorme.
  if (!GERACAO_IA_ATIVA || !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "A geração por IA está desativada no momento." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Indisponível." }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  // Rate limit: janela de 24h por proprietário.
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("ai_generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", desde);
  if ((count ?? 0) >= IA_LIMITE_DIA) {
    return NextResponse.json(
      { error: `Limite de ${IA_LIMITE_DIA} gerações por dia atingido. Tente novamente amanhã.` },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as AnuncioBriefInput;
  const brief = montarBrief(body);

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system: IA_SYSTEM_PROMPT,
      // effort baixo: tarefa curta; formato estruturado garante JSON válido.
      output_config: { effort: "low", format: { type: "json_schema", schema: IA_OUTPUT_SCHEMA } },
      messages: [
        {
          role: "user",
          content:
            "Gere título e descrição para este imóvel, seguindo as regras. Dados (JSON):\n" +
            JSON.stringify(brief),
        },
      ],
    });

    const bloco = res.content.find((b) => b.type === "text");
    const raw = bloco && bloco.type === "text" ? bloco.text : "";
    let titulo = "";
    let descricao = "";
    try {
      const parsed = JSON.parse(raw) as { titulo?: string; descricao?: string };
      titulo = limparSaida(String(parsed.titulo ?? "")).slice(0, 120);
      descricao = limparSaida(String(parsed.descricao ?? "")).slice(0, 800);
    } catch {
      return NextResponse.json({ error: "Não foi possível gerar agora. Tente de novo." }, { status: 502 });
    }

    // Guarda-corpo final: se ainda restar contato, recusa (não devolve vazamento).
    if (!titulo || !descricao || contemContato(titulo) || contemContato(descricao)) {
      return NextResponse.json({ error: "Não foi possível gerar um texto válido agora." }, { status: 502 });
    }

    // Registra a geração (rate-limit + auditoria). Best-effort: não trava a resposta.
    await supabase.from("ai_generations").insert({ user_id: user.id, kind: "anuncio" });

    return NextResponse.json({ titulo, descricao });
  } catch {
    // Erros do provedor (chave inválida, rate/overload) não vazam detalhes.
    return NextResponse.json({ error: "A geração por IA está indisponível agora." }, { status: 503 });
  }
}
