import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { classificarFalhaIa, textoDaResposta } from "@/lib/ai/falha-ia";
import { registrarChamadaIa } from "@/lib/ai/registro-ia";
import { DETECCAO_OUTPUT_SCHEMA, DETECCAO_SYSTEM_PROMPT, LADO_DETECCAO_PX, MODELO_DETECCAO } from "./deteccao";

/*
  DETECTA-B — a chamada ao modelo com UMA foto da galeria. A foto vai reduzida (1024 px, JPEG, sem EXIF) e sozinha: sem
  nome, endereço ou qualquer dado da pessoa. Cada chamada vira uma linha em ia_chamadas (rota 'deteccao', sem conteúdo).
  Devolve o JSON cru (quem valida é validarDeteccao); resposta cortada, recusada ou fora de JSON volta como texto, que
  a validação trata como inválida. Falha da API lança (a rodada tenta de novo outro dia, dentro do limite).
*/
export async function detectarNaFoto(bytes: Uint8Array): Promise<unknown> {
  const inicio = Date.now();
  const jpeg = await sharp(bytes, { limitInputPixels: 100_000_000 })
    .rotate()
    .resize({ width: LADO_DETECCAO_PX, height: LADO_DETECCAO_PX, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  const registro = { rota: "deteccao" as const, modelo: MODELO_DETECCAO, arquivoMime: "image/jpeg", arquivoBytes: jpeg.length, reduzido: true };
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await anthropic.messages.create({
      model: MODELO_DETECCAO,
      max_tokens: 1024,
      system: DETECCAO_SYSTEM_PROMPT,
      output_config: { effort: "low", format: { type: "json_schema", schema: DETECCAO_OUTPUT_SCHEMA as unknown as Record<string, unknown> } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } },
            { type: "text", text: "Quais itens da lista aparecem nesta foto? Há alguma pessoa?" },
          ],
        },
      ],
    });
    let texto: string;
    try {
      texto = textoDaResposta(res);
    } catch {
      await registrarChamadaIa({ ...registro, ok: false, status: 200, tipoErro: `resposta_${res.stop_reason ?? "incompleta"}`, duracaoMs: Date.now() - inicio });
      return null;
    }
    await registrarChamadaIa({ ...registro, ok: true, status: 200, duracaoMs: Date.now() - inicio });
    try {
      return JSON.parse(texto);
    } catch {
      return texto;
    }
  } catch (e) {
    const f = classificarFalhaIa(e);
    await registrarChamadaIa({ ...registro, ok: false, status: f.status, tipoErro: f.tipo, motivo: f.motivo, erroResumo: f.resumo, duracaoMs: Date.now() - inicio });
    throw e;
  }
}
