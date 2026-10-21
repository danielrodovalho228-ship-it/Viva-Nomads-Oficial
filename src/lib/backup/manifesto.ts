/*
  Resiliência 2 — manifesto da cópia noturna (puro, sem I/O). Vai cifrado para
  cripto:VivaNomads-Backup/manifestos/AAAA-MM-DD.json e é o que o teste de restauração confere.
  Só números e nomes técnicos: tamanho e SHA-256 do dump, linhas por tabela, objetos e bytes por bucket, a lista de
  migrações e se as 5 consultas-chave acharam um registro. NENHUM dado pessoal e nenhum nome de arquivo de usuário:
  tudo que entra é validado por formato e, no fim, cada texto do JSON passa por um filtro de e-mail, CPF, telefone
  e caminho de arquivo. Algo fora do formato derruba a cópia (melhor vermelho do que vazar).
  Roda: node --test src/lib/backup/backup.test.ts
*/
import { CONSULTAS_CHAVE, type NomeConsultaChave } from "./consultas-chave.ts";

export const VERSAO_MANIFESTO = 1;

export interface EntradaManifesto {
  geradoEm: string;
  dump: { arquivo: string; bytes: number; sha256: string };
  tabelas: Record<string, number>;
  buckets: Record<string, { objetos: number; bytes: number }>;
  /** "versão nome" de supabase_migrations.schema_migrations. */
  migracoes: string[];
  /** Consulta-chave → achou ao menos um registro em produção. */
  chaves: Partial<Record<NomeConsultaChave, boolean>>;
}

export interface Manifesto {
  versao: number;
  geradoEm: string;
  dump: { arquivo: string; bytes: number; sha256: string };
  tabelas: Record<string, number>;
  totalLinhas: number;
  storage: { buckets: Record<string, { objetos: number; bytes: number }>; objetos: number; bytes: number };
  migracoes: { total: number; ultima: string | null; lista: string[] };
  chaves: Partial<Record<NomeConsultaChave, boolean>>;
}

export const RE_ARQUIVO_DUMP = /^\d{4}-\d{2}-\d{2}_\d{4}\.dump$/;
const RE_SHA256 = /^[0-9a-f]{64}$/;
const RE_TABELA = /^[a-z_][a-z0-9_$]{0,62}\.[a-z_][a-z0-9_$]{0,62}$/;
const RE_BUCKET = /^[a-z0-9][a-z0-9._-]{0,62}$/;
const RE_MIGRACAO = /^\d{1,20}(?: [a-z0-9_]{1,120})?$/;
const RE_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

/** Padrões que NUNCA podem aparecer num texto do manifesto. */
export const PADROES_PROIBIDOS: Record<string, RegExp> = {
  email: /[^\s@"]+@[^\s@"]+\.[a-z]{2,}/i,
  cpf: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|^\d{11}$/,
  telefone: /\(?\b\d{2}\)?\s?9?\d{4}-\d{4}\b|^\+?55\d{10,11}$/,
  arquivo: /\/|\.(?:jpe?g|png|webp|heic|gif|pdf|docx?|mp4|mov|txt|csv)$/i,
};

const inteiro = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;

function erro(o_que: string): never {
  // A mensagem diz O QUE estava fora do formato, nunca o valor.
  throw new Error(`manifesto: ${o_que} fora do formato`);
}

/** Todo texto (chave ou valor) de um objeto JSON. */
function textos(v: unknown, saida: string[] = []): string[] {
  if (typeof v === "string") saida.push(v);
  else if (Array.isArray(v)) for (const x of v) textos(x, saida);
  else if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) {
      saida.push(k);
      textos(x, saida);
    }
  return saida;
}

/** Nome do primeiro padrão proibido achado (ou null). O arquivo do dump é o único texto com extensão permitido. */
export function dadoPessoalNoManifesto(m: unknown): string | null {
  for (const t of textos(m)) {
    if (RE_ARQUIVO_DUMP.test(t) || RE_SHA256.test(t)) continue;
    for (const [nome, re] of Object.entries(PADROES_PROIBIDOS)) if (re.test(t)) return nome;
  }
  return null;
}

export function montarManifesto(e: EntradaManifesto): Manifesto {
  if (!RE_ISO.test(e.geradoEm)) erro("geradoEm");
  if (!RE_ARQUIVO_DUMP.test(e.dump.arquivo)) erro("nome do dump");
  if (!inteiro(e.dump.bytes)) erro("tamanho do dump");
  if (!RE_SHA256.test(e.dump.sha256)) erro("hash do dump");

  const tabelas: Record<string, number> = {};
  let totalLinhas = 0;
  for (const k of Object.keys(e.tabelas).sort()) {
    if (!RE_TABELA.test(k)) erro("nome de tabela");
    if (!inteiro(e.tabelas[k])) erro("contagem de tabela");
    tabelas[k] = e.tabelas[k];
    totalLinhas += e.tabelas[k];
  }

  const buckets: Record<string, { objetos: number; bytes: number }> = {};
  let objetos = 0;
  let bytes = 0;
  for (const k of Object.keys(e.buckets).sort()) {
    const b = e.buckets[k];
    if (!RE_BUCKET.test(k)) erro("nome de bucket");
    if (!inteiro(b.objetos) || !inteiro(b.bytes)) erro("contagem de bucket");
    buckets[k] = { objetos: b.objetos, bytes: b.bytes };
    objetos += b.objetos;
    bytes += b.bytes;
  }

  const lista = [...e.migracoes].sort();
  for (const m of lista) if (!RE_MIGRACAO.test(m)) erro("migração");

  const chaves: Partial<Record<NomeConsultaChave, boolean>> = {};
  for (const [k, v] of Object.entries(e.chaves)) {
    if (!(k in CONSULTAS_CHAVE) || typeof v !== "boolean") erro("consulta-chave");
    chaves[k as NomeConsultaChave] = v;
  }

  const m: Manifesto = {
    versao: VERSAO_MANIFESTO,
    geradoEm: e.geradoEm,
    dump: { arquivo: e.dump.arquivo, bytes: e.dump.bytes, sha256: e.dump.sha256 },
    tabelas,
    totalLinhas,
    storage: { buckets, objetos, bytes },
    migracoes: { total: lista.length, ultima: lista[lista.length - 1] ?? null, lista },
    chaves,
  };
  if (dadoPessoalNoManifesto(m)) erro("texto");
  return m;
}

/** Lê um manifesto (do Drive, já decifrado) conferindo o formato de novo. */
export function lerManifesto(json: string): Manifesto {
  const m = JSON.parse(json) as Manifesto;
  if (!m || m.versao !== VERSAO_MANIFESTO) erro("versão");
  return montarManifesto({
    geradoEm: m.geradoEm,
    dump: m.dump,
    tabelas: m.tabelas,
    buckets: m.storage?.buckets ?? {},
    migracoes: m.migracoes?.lista ?? [],
    chaves: m.chaves ?? {},
  });
}
