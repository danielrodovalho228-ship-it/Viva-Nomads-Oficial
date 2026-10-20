import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { GERACAO_IA_ATIVA } from "@/lib/flags";
import { consumirLimite, ipHash, DIA } from "@/lib/limites";
import { integracoesSimuladas, registrarSimulado } from "@/lib/integracoes";
import { IA_LIMITE_DIA } from "@/lib/ai/anuncio-prompt";
import { classificarFalhaIa, textoDaResposta, MENSAGEM_FALHA_IA, type MotivoFalhaIa } from "@/lib/ai/falha-ia";
import { registrarChamadaIa } from "@/lib/ai/registro-ia";
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
 * rascunho). No laboratório (INTEGRACOES_SIMULADAS=on) devolve SEMPRE a mesma resposta fixa, sem chamar a API.
 *
 * Prompt 22: toda falha volta com `motivo` (desligada · limite · arquivo_grande · ilegivel · indisponivel) para a tela
 * dizer o que houve — nunca mais o silencioso "Sem sugestões" — e vira uma linha em ia_chamadas (0163), sem dado
 * pessoal, que o painel "IA do cadastro" do /admin mostra.
 */
const MODELO_FOTOS = "claude-opus-4-8";

function falha(motivo: MotivoFalhaIa, status: number, texto = MENSAGEM_FALHA_IA[motivo]) {
  return NextResponse.json({ error: texto, motivo }, { status });
}

export async function POST(request: Request) {
  const simulado = integracoesSimuladas();
  const desligada = !simulado && (!GERACAO_IA_ATIVA || !process.env.ANTHROPIC_API_KEY);

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
  if (desligada) {
    await registrarChamadaIa({ rota: "fotos", ok: false, status: 503, tipoErro: !GERACAO_IA_ATIVA ? "flag_desligada" : "sem_chave", motivo: "desligada" });
    return falha("desligada", 503);
  }

  const cru = await request.text().catch(() => "");
  if (cru.length > FOTOS_MAX_CORPO) {
    return falha("arquivo_grande", 413, "Fotos demais para analisar de uma vez.");
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
    return falha("limite", 429, `Limite de ${IA_LIMITE_DIA} análises por dia atingido. Tente de novo amanhã ou preencha os campos na próxima etapa.`);
  }

  if (simulado) {
    await registrarSimulado("ia", { acao: "fotos", fotos: miniaturas.length });
    const lab = sanearSugestao(SUGESTAO_LAB_BRUTA);
    return lab.ok ? NextResponse.json(lab.sugestao) : NextResponse.json({ error: "Indisponível." }, { status: 503 });
  }

  const inicio = Date.now();
  const bytes = miniaturas.reduce((t, m) => t + Math.floor((m.length * 3) / 4), 0);
  const registro = { rota: "fotos" as const, modelo: MODELO_FOTOS, arquivoMime: "image/jpeg", arquivoBytes: bytes };
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await anthropic.messages.create({
      model: MODELO_FOTOS,
      max_tokens: 4096,
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

    const saneada = sanearSugestao(JSON.parse(textoDaResposta(res)));
    if (!saneada.ok) {
      const motivo: MotivoFalhaIa = saneada.motivo === "nao_imovel" ? "ilegivel" : "indisponivel";
      await registrarChamadaIa({ ...registro, ok: false, status: 200, tipoErro: `saneamento_${saneada.motivo}`, motivo, duracaoMs: Date.now() - inicio });
      return saneada.motivo === "nao_imovel"
        ? falha("ilegivel", 422, "Estas fotos não parecem ser de um imóvel. Envie fotos dos ambientes.")
        : falha("indisponivel", 502);
    }

    await registrarChamadaIa({ ...registro, ok: true, status: 200, duracaoMs: Date.now() - inicio });
    await supabase.from("ai_generations").insert({ user_id: user.id, kind: "anuncio" });
    return NextResponse.json(saneada.sugestao);
  } catch (e) {
    const f = classificarFalhaIa(e);
    await registrarChamadaIa({ ...registro, ok: false, status: f.status, tipoErro: f.tipo, motivo: f.motivo, duracaoMs: Date.now() - inicio });
    return falha(f.motivo, f.motivo === "arquivo_grande" ? 413 : 503);
  }
}
