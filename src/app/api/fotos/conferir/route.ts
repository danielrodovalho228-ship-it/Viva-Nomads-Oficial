import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { consumirLimite, DIA } from "@/lib/limites";
import { integracoesSimuladas, registrarSimulado } from "@/lib/integracoes";
import { deteccaoAtiva } from "@/lib/fotos/deteccao-chave";
import { MODELO_DETECCAO } from "@/lib/fotos/deteccao";
import { validarMiniaturas } from "@/lib/ai/fotos-prompt";
import { textoDaResposta } from "@/lib/ai/falha-ia";
import { registrarChamadaIa } from "@/lib/ai/registro-ia";
import {
  CONTEUDO_OUTPUT_SCHEMA,
  CONTEUDO_SYSTEM_PROMPT,
  juntarConteudo,
  medirTela,
  pareceTela,
  validarConteudo,
  type ConteudoFoto,
} from "@/lib/fotos/conteudo";

/**
 * E133 — "esta foto é do imóvel?" (cada foto do anúncio e os 3 quadros do vídeo enviado). O navegador manda só
 * miniaturas JPEG em base64 (sem EXIF, sem URL, nada da pessoa); o servidor não grava nada — o resultado volta para
 * a tela e fica no rascunho, junto da foto.
 * • A medida local de tela (print, documento) roda sempre (sharp, sem rede).
 * • Com a detecção ligada (DETECCAO_FOTOS_ATIVO), o modelo confere cada imagem; erro do modelo não trava a foto.
 * • Laboratório (INTEGRACOES_SIMULADAS): nada sai para a rede; a medida local faz o papel do modelo.
 * • Limite diário por pessoa, contado antes do modelo; cada chamada vira uma linha em ia_chamadas (rota 'deteccao').
 */
export const LIMITE_CONFERIR_DIA = 400;

async function medir(base64: string): Promise<boolean> {
  try {
    const { data, info } = await sharp(Buffer.from(base64, "base64"), { limitInputPixels: 20_000_000 })
      .resize(256, 256, { fit: "inside" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return pareceTela(medirTela(data, info.width, info.height));
  } catch {
    return false;
  }
}

async function perguntarAoModelo(anthropic: Anthropic, base64: string): Promise<ConteudoFoto | null> {
  const inicio = Date.now();
  const registro = { rota: "deteccao" as const, modelo: MODELO_DETECCAO, arquivoMime: "image/jpeg", arquivoBytes: Math.floor((base64.length * 3) / 4), reduzido: true };
  try {
    const res = await anthropic.messages.create({
      model: MODELO_DETECCAO,
      max_tokens: 256,
      system: CONTEUDO_SYSTEM_PROMPT,
      output_config: { effort: "low", format: { type: "json_schema", schema: CONTEUDO_OUTPUT_SCHEMA as unknown as Record<string, unknown> } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
            { type: "text", text: "Esta imagem mostra um ambiente do imóvel?" },
          ],
        },
      ],
    });
    const v = validarConteudo(JSON.parse(textoDaResposta(res)));
    await registrarChamadaIa({ ...registro, ok: !!v, status: 200, tipoErro: v ? undefined : "conteudo_invalido", duracaoMs: Date.now() - inicio });
    return v;
  } catch {
    await registrarChamadaIa({ ...registro, ok: false, status: 503, tipoErro: "conteudo_falha", duracaoMs: Date.now() - inicio });
    return null;
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Indisponível." }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const cru = await request.text().catch(() => "");
  if (cru.length > 2_800_000) return NextResponse.json({ error: "Imagens demais de uma vez." }, { status: 413 });
  let miniaturas: string[];
  try {
    const parsed: unknown = JSON.parse(cru || "{}");
    const v = validarMiniaturas(parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>).miniaturas : undefined);
    if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 });
    miniaturas = v.miniaturas;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  if (!(await consumirLimite(`conteudo:user:${user.id}`, LIMITE_CONFERIR_DIA, DIA))) {
    return NextResponse.json({ error: "Limite de conferências de hoje atingido." }, { status: 429 });
  }

  const simulado = integracoesSimuladas();
  const comModelo = !simulado && !!process.env.ANTHROPIC_API_KEY && (await deteccaoAtiva());
  if (simulado) await registrarSimulado("ia", { acao: "conferir_conteudo", fotos: miniaturas.length });
  const anthropic = comModelo ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

  const resultados = await Promise.all(
    miniaturas.map(async (m) => {
      const [tela, modelo] = await Promise.all([medir(m), anthropic ? perguntarAoModelo(anthropic, m) : Promise.resolve(null)]);
      return juntarConteudo(modelo, tela);
    }),
  );
  return NextResponse.json({ resultados, modelo: comModelo });
}
