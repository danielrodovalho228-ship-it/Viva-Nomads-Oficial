import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { vivaAtiva } from "@/lib/atendimento/viva-servidor";
import { aceitaEsforco, aceitaReserva, modeloViva } from "@/lib/atendimento/viva-custo";
import { CHAT_LIMITES, responderChatViva, type MsgChat } from "@/lib/atendimento/viva-chat";
import { DIA, HORA, ipHash, situacaoLimite } from "@/lib/limites";

/**
 * Chat da Viva no site (visitante e logado). Sem ferramentas e sem dados de
 * conta: só as fontes oficiais. Limite por IP/hora e o teto diário da Viva.
 */
export const maxDuration = 60;

function limiteDia(): number {
  const n = Number(process.env.ATENDIMENTO_IA_LIMITE_DIA);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 300;
}

async function modelo(system: string, mensagens: MsgChat[]): Promise<string> {
  const m = modeloViva();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 45_000, maxRetries: 1 });
  const res = await client.beta.messages.create({
    model: m,
    // Inclui o raciocínio interno do modelo; a resposta em si é curta (≤ 5 frases).
    max_tokens: 1200,
    ...(aceitaEsforco(m) ? { output_config: { effort: "low" as const } } : {}),
    ...(aceitaReserva(m) ? { betas: ["server-side-fallback-2026-06-01"], fallbacks: [{ model: "claude-opus-4-8" }] } : {}),
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: mensagens,
  });
  if (res.stop_reason === "refusal") return "";
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const ip = ipHash(request);
  const r = await responderChatViva(
    {
      ativa: vivaAtiva(),
      async limite() {
        const porIp = await situacaoLimite(`viva-chat:ip:${ip}`, CHAT_LIMITES.porIpHora, HORA);
        if (porIp !== "ok") return porIp;
        return situacaoLimite("viva:dia", limiteDia(), DIA);
      },
      modelo,
    },
    body
  );
  return NextResponse.json(r.body, { status: r.status });
}
