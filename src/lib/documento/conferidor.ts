import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { integracoesSimuladas, registrarSimulado } from "@/lib/integracoes";
import { classificarFalhaIa, textoDaResposta, type FalhaIa, type RotaIa } from "@/lib/ai/falha-ia";
import { registrarChamadaIa } from "@/lib/ai/registro-ia";
import { precisaReduzirImagem, IMAGEM_LADO_MAX_PX } from "@/lib/documento/arquivo-leitura";
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
import {
  casoLabMatricula,
  leituraMatriculaSimulada,
  sanearMatricula,
  MATRICULA_OUTPUT_SCHEMA,
  MATRICULA_SYSTEM_PROMPT,
  type EntradaMatricula,
  type LeituraMatricula,
} from "@/lib/documento/conferencia-matricula";

/*
  CONFERIDOR do documento do imóvel (prompt 11): quem LÊ o arquivo. Todos têm a mesma interface, para trocar por
  configuração:
    • "lab"    — laboratório (INTEGRACOES_SIMULADAS=on): leitura simulada fixa, nada sai para a rede;
    • "certta" — Certta (ex-CAF) Smart OCR, PREPARADO e DESLIGADO até o contrato (CERTTA_SMART_OCR=on);
    • "ia"     — modelo de visão da Anthropic (a mesma chave do assistente), uma chamada por documento.
  Sem nenhum disponível, ou com erro, a leitura é null → o caso vai para a revisão humana, sem travar o cadastro.
  Prompt 22: o erro NÃO é mais engolido — volta como `falha` (motivo para a tela: arquivo grande, ilegível,
  indisponível) e vira uma linha em ia_chamadas (0163) sem dado pessoal. Foto grande de celular é reduzida antes
  do envio (o limite da API para imagem é menor que o de PDF).

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
  /** A leitura falhou (prompt 22): o motivo vai para a tela e para o registro. */
  falha?: FalhaIa;
}

/** Modelo de visão usado na leitura (o mesmo da leitura das fotos do cadastro). */
export const MODELO_LEITURA = "claude-opus-4-8";

export function conferidorAtivo(): NomeConferidor {
  if (integracoesSimuladas()) return "lab";
  if (certtaOcrAtivo()) return "certta";
  if (process.env.ANTHROPIC_API_KEY) return "ia";
  return "nenhum";
}

function blocoDoArquivo(arquivo: ArquivoDocumento) {
  const data = Buffer.from(arquivo.bytes).toString("base64");
  return arquivo.mime === "application/pdf"
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data } }
    : {
        type: "image" as const,
        source: { type: "base64" as const, media_type: (arquivo.mime === "image/png" ? "image/png" : "image/jpeg") as "image/png" | "image/jpeg", data },
      };
}

/** Matrícula FICTÍCIA do laboratório (marcador VIVA-LAB-MAT no arquivo)? Só com as integrações simuladas. */
export function matriculaDoLaboratorio(bytes: Uint8Array) {
  return conferidorAtivo() === "lab" ? casoLabMatricula(bytes) : null;
}

export interface LeituraMatriculaComOrigem {
  leitura: LeituraMatricula | null;
  conferidor: NomeConferidor;
  modelo: string | null;
  falha?: FalhaIa;
}

/**
 * Prepara o arquivo para a leitura: imagem acima do limite (foto de celular de 5 MB ou mais, ou lados grandes demais)
 * é girada pela orientação da câmera e reduzida para JPEG de até IMAGEM_LADO_MAX_PX. PDF vai como veio.
 */
async function prepararParaLeitura(arquivo: ArquivoDocumento): Promise<{ arquivo: ArquivoDocumento; reduzido: boolean }> {
  if (arquivo.mime === "application/pdf") return { arquivo, reduzido: false };
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(arquivo.bytes).metadata();
    if (!precisaReduzirImagem(arquivo.bytes.length, meta.width ?? 0, meta.height ?? 0)) return { arquivo, reduzido: false };
    const saida = await sharp(arquivo.bytes)
      .rotate()
      .resize({ width: IMAGEM_LADO_MAX_PX, height: IMAGEM_LADO_MAX_PX, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    return { arquivo: { bytes: new Uint8Array(saida), mime: "image/jpeg" }, reduzido: true };
  } catch (e) {
    console.warn("[conferidor] não reduziu a imagem:", e instanceof Error ? e.message : "erro");
    return { arquivo, reduzido: false };
  }
}

/** Uma chamada de leitura com registro (ok ou falha, sem dado pessoal) e o erro classificado — nunca engolido. */
async function chamarLeitura<T>(
  rota: RotaIa,
  original: ArquivoDocumento,
  pedir: (a: ArquivoDocumento) => Promise<Anthropic.Message>,
  sanear: (json: unknown) => T,
): Promise<{ leitura: T | null; falha?: FalhaIa }> {
  const inicio = Date.now();
  const { arquivo, reduzido } = await prepararParaLeitura(original);
  const base = { rota, modelo: MODELO_LEITURA, arquivoMime: original.mime, arquivoBytes: original.bytes.length, reduzido };
  try {
    const leitura = sanear(JSON.parse(textoDaResposta(await pedir(arquivo))));
    await registrarChamadaIa({ ...base, ok: true, status: 200, duracaoMs: Date.now() - inicio });
    return { leitura };
  } catch (e) {
    const falha = classificarFalhaIa(e);
    await registrarChamadaIa({ ...base, ok: false, status: falha.status, tipoErro: falha.tipo, motivo: falha.motivo, duracaoMs: Date.now() - inicio });
    return { leitura: null, falha };
  }
}

/**
 * Leitura da MATRÍCULA (prompt 19): número, cartório, endereço, unidade, áreas, vaga, proprietários, último ato e
 * ônus em aberto. Mesma regra do documento: a IA só lê; quem decide é conferencia-matricula.ts.
 */
export async function lerMatricula(
  arquivo: ArquivoDocumento,
  ctx: { perfil: EntradaMatricula["perfil"]; endereco: CadastroComparado["endereco"]; hoje: string },
): Promise<LeituraMatriculaComOrigem> {
  const qual = conferidorAtivo();
  if (qual === "lab") {
    const caso = casoLabMatricula(arquivo.bytes);
    await registrarSimulado("ia", { acao: "ler_matricula", caso: caso ?? "sem_marcador" });
    return { leitura: caso ? leituraMatriculaSimulada(caso, ctx) : null, conferidor: "lab", modelo: null };
  }
  // Certta Smart OCR não lê matrícula (só comprovante): sem a IA, o caso vai para a revisão humana.
  if (qual !== "ia") return { leitura: null, conferidor: qual, modelo: null };
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const r = await chamarLeitura(
    "matricula",
    arquivo,
    (a) =>
      anthropic.messages.create({
        model: MODELO_LEITURA,
        // Matrícula longa (vários proprietários e atos) não pode sair cortada: o JSON cortado virava "não foi possível ler".
        max_tokens: 8192,
        system: MATRICULA_SYSTEM_PROMPT,
        output_config: { effort: "low", format: { type: "json_schema", schema: MATRICULA_OUTPUT_SCHEMA } },
        messages: [{ role: "user", content: [blocoDoArquivo(a), { type: "text" as const, text: "Leia esta matrícula seguindo as regras." }] }],
      }),
    sanearMatricula,
  );
  return { leitura: r.leitura, conferidor: "ia", modelo: MODELO_LEITURA, falha: r.falha };
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

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const r = await chamarLeitura(
    "documento",
    arquivo,
    (a) =>
      anthropic.messages.create({
        model: MODELO_LEITURA,
        max_tokens: 2048,
        system: LEITURA_SYSTEM_PROMPT,
        output_config: { effort: "low", format: { type: "json_schema", schema: LEITURA_OUTPUT_SCHEMA } },
        messages: [{ role: "user", content: [blocoDoArquivo(a), { type: "text" as const, text: "Leia este documento seguindo as regras." }] }],
      }),
    sanearLeitura,
  );
  return { leitura: r.leitura, conferidor: "ia", modelo: MODELO_LEITURA, falha: r.falha };
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
