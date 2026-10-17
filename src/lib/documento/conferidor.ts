import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { integracoesSimuladas, registrarSimulado } from "@/lib/integracoes";
import { lerComprovanteCertta, certtaOcrAtivo } from "@/lib/integrations/caf";
import {
  casoLabDoArquivo,
  leituraSimulada,
  sanearLeitura,
  LEITURA_OUTPUT_SCHEMA,
  LEITURA_SYSTEM_PROMPT,
  type CadastroComparado,
  type LeituraDocumento,
} from "@/lib/documento/conferencia";

/*
  CONFERIDOR do documento do imóvel (prompt 11): quem LÊ o arquivo. Todos têm a mesma interface, para trocar por
  configuração:
    • "lab"    — laboratório (INTEGRACOES_SIMULADAS=on): leitura simulada fixa, nada sai para a rede;
    • "certta" — Certta (ex-CAF) Smart OCR, PREPARADO e DESLIGADO até o contrato (CERTTA_SMART_OCR=on);
    • "ia"     — modelo de visão da Anthropic (a mesma chave do assistente), uma chamada por documento.
  Sem nenhum disponível, ou com erro, a leitura é null → o caso vai para a revisão humana, sem travar o cadastro.

  Matrícula pelo ONR/Registradores (Infosimples): só a interface abaixo. Exige certificado digital e tem custo por
  pedido; uso futuro apenas nos casos em revisão ou para o selo "Dono verificado". NÃO implementado.
*/

export type NomeConferidor = "lab" | "certta" | "ia" | "nenhum";

export interface ArquivoDocumento {
  bytes: Uint8Array;
  /** application/pdf | image/jpeg | image/png */
  mime: string;
}

export interface LeituraComOrigem {
  leitura: LeituraDocumento | null;
  conferidor: NomeConferidor;
  modelo: string | null;
}

/** Modelo de visão usado na leitura (o mesmo da leitura das fotos do cadastro). */
export const MODELO_LEITURA = "claude-opus-4-8";

export function conferidorAtivo(): NomeConferidor {
  if (integracoesSimuladas()) return "lab";
  if (certtaOcrAtivo()) return "certta";
  if (process.env.ANTHROPIC_API_KEY) return "ia";
  return "nenhum";
}

export async function lerDocumento(arquivo: ArquivoDocumento, cadastro: CadastroComparado): Promise<LeituraComOrigem> {
  const qual = conferidorAtivo();
  if (qual === "lab") {
    const caso = casoLabDoArquivo(arquivo.bytes);
    await registrarSimulado("ia", { acao: "conferir_documento", caso: caso ?? "sem_marcador" });
    return { leitura: caso ? leituraSimulada(caso, cadastro) : null, conferidor: "lab", modelo: null };
  }
  if (qual === "certta") {
    return { leitura: await lerComprovanteCertta(arquivo.bytes, arquivo.mime), conferidor: "certta", modelo: null };
  }
  if (qual === "nenhum") return { leitura: null, conferidor: "nenhum", modelo: null };

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const data = Buffer.from(arquivo.bytes).toString("base64");
    const bloco =
      arquivo.mime === "application/pdf"
        ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data } }
        : {
            type: "image" as const,
            source: { type: "base64" as const, media_type: (arquivo.mime === "image/png" ? "image/png" : "image/jpeg") as "image/png" | "image/jpeg", data },
          };
    const res = await anthropic.messages.create({
      model: MODELO_LEITURA,
      max_tokens: 1024,
      system: LEITURA_SYSTEM_PROMPT,
      output_config: { effort: "low", format: { type: "json_schema", schema: LEITURA_OUTPUT_SCHEMA } },
      messages: [{ role: "user", content: [bloco, { type: "text" as const, text: "Leia este documento seguindo as regras." }] }],
    });
    const texto = res.content.find((b) => b.type === "text");
    const leitura = sanearLeitura(JSON.parse(texto && texto.type === "text" ? texto.text : ""));
    return { leitura, conferidor: "ia", modelo: MODELO_LEITURA };
  } catch {
    return { leitura: null, conferidor: "ia", modelo: MODELO_LEITURA };
  }
}

/**
 * Consulta de matrícula no ONR/Registradores — NÃO IMPLEMENTADA (interface reservada).
 * TODO(onr): exige certificado digital A1 da Viva e tem custo por pedido. Usar só nos casos em revisão ou para o
 * selo "Dono verificado", depois do contrato com o fornecedor (Infosimples) e da revisão da Dra. Beatriz.
 */
export interface ConsultaMatriculaOnr {
  cartorio: string;
  matricula: string;
}
export async function consultarMatriculaOnr(_c: ConsultaMatriculaOnr): Promise<null> {
  return null;
}
