import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sha256 } from "@/lib/fiscal/pdf";
import { PREFIXOS, temRps, type Prefixo } from "@/lib/fiscal/prefixos";

/**
 * A função ÚNICA de registro de documentos (Prompt 56). Todo documento gerado pela plataforma passa por aqui
 * (o teste de guarda falha se algum gerador de PDF não chamar registrarDocumento):
 *   1. número: o do contador (proximo_numero_documento, 6 dígitos, ano de Brasília), o que veio de fora (ORC, VN-CT,
 *      aditivo) ou — em versão nova — o mesmo número da versão anterior;
 *   2. código de verificação (128 bits, nunca sequencial);
 *   3. o conteúdo é montado COM o número e o código (vão impressos) e o hash sai dele (sha256 do PDF ou do texto);
 *   4. registrar_documento grava a linha (e, em versão nova, marca a anterior como "substituído" na mesma transação).
 */

/** O cliente do SERVIDOR (service role): registrar_documento só executa com ele. */
type Admin = SupabaseClient;

export interface Identificacao {
  numero: string;
  versao: number;
  codigo: string;
}

export interface EntradaRegistro {
  prefixo: Prefixo;
  /** Tipo do documento (texto curto: "recibo_aluguel", "pacote_provas", "aditivo"…). */
  tipo: string;
  /** O que o documento documenta. */
  ref: { tabela: string; id: string };
  /** Quem pode ler o registro (as partes do documento). */
  partes: (string | null | undefined)[];
  emitidoPor?: string | null;
  /** Número que vem de fora (ORC, VN-CT, aditivo). Sem ele, o contador do prefixo numera. */
  numero?: string;
  /** Versão nova do documento desta referência: mesmo número, versão + 1. */
  novaVersao?: boolean;
  /** A versão do próprio documento (ex.: a rodada da proposta), quando ele já numera as versões. */
  versao?: number;
  /** Monta o conteúdo com o número, a versão e o código que vão impressos. */
  conteudo: (id: Identificacao) => Promise<Uint8Array | string> | Uint8Array | string;
}

export interface DocumentoRegistrado extends Identificacao {
  id: string;
  registroSeq: number;
  hash: string;
  bytes: Uint8Array | string;
}

export class ErroRegistro extends Error {}

async function numeroDoContador(admin: Admin, prefixo: Prefixo): Promise<string> {
  const regra = PREFIXOS[prefixo];
  if (regra.numeracao === "proprio") throw new ErroRegistro(`${prefixo}: o número vem de fora`);
  const { data, error } = await admin.rpc("proximo_numero_documento", { p_tipo: regra.numeracao.contador });
  if (error || typeof data !== "string") throw new ErroRegistro("numeração indisponível");
  return data;
}

export async function registrarDocumento(admin: Admin, e: EntradaRegistro): Promise<DocumentoRegistrado> {
  const partes = [...new Set(e.partes.filter((p): p is string => !!p))];
  let numero = e.numero ?? null;
  let versao = 1;
  if (e.novaVersao) {
    const { data: anterior } = await admin
      .from("documentos_registro")
      .select("numero, versao")
      .eq("prefixo", e.prefixo)
      .eq("ref_tabela", e.ref.tabela)
      .eq("ref_id", e.ref.id)
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (anterior) {
      numero = anterior.numero as string;
      versao = Math.max(Number(anterior.versao) + 1, e.versao ?? 0);
    }
  } else if (e.versao) {
    versao = e.versao;
  }
  numero ??= await numeroDoContador(admin, e.prefixo);
  if (temRps(numero)) throw new ErroRegistro("RPS não é prefixo da Viva");

  const codigo = randomBytes(16).toString("hex");
  const bytes = await e.conteudo({ numero, versao, codigo });
  const hash = sha256(typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes);

  const { data: perfis } = partes.length ? await admin.from("profiles").select("is_teste").in("id", partes) : { data: [] };
  const isTeste = ((perfis ?? []) as { is_teste: boolean | null }[]).some((p) => p.is_teste === true);

  const { data, error } = await admin.rpc("registrar_documento", {
    p_prefixo: e.prefixo,
    p_tipo: e.tipo,
    p_numero: numero,
    p_ref_tabela: e.ref.tabela,
    p_ref_id: e.ref.id,
    p_hash: hash,
    p_codigo: codigo,
    p_partes: partes,
    p_is_teste: isTeste,
    p_emitido_por: e.emitidoPor ?? null,
    p_nova_versao: !!e.novaVersao,
    p_versao: versao,
  });
  const linha = (Array.isArray(data) ? data[0] : data) as { id: string; numero: string; versao: number; registro_seq: number } | null;
  if (error || !linha) throw new ErroRegistro(`registro: ${error?.message ?? "falhou"}`);
  return { id: linha.id, numero: linha.numero, versao: Number(linha.versao), codigo, registroSeq: Number(linha.registro_seq), hash, bytes };
}

/** Registro nº do documento legado (VN-CT/VN-SV) desta referência, para exibir ao lado do número. */
export async function registroDe(admin: Admin, ref: { tabela: string; id: string }): Promise<{ registroSeq: number; codigo: string } | null> {
  const { data } = await admin
    .from("documentos_registro")
    .select("registro_seq, codigo_verificacao")
    .eq("ref_tabela", ref.tabela)
    .eq("ref_id", ref.id)
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { registroSeq: Number(data.registro_seq), codigo: data.codigo_verificacao as string } : null;
}
