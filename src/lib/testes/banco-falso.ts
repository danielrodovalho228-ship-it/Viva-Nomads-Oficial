/*
  Um banco falso FIEL para as travas que correm ações e rotinas reais (E1248): guarda as linhas em memória, aplica os
  filtros do supabase-js (eq, neq, in, is, not, gte, lte, lt), devolve só as colunas que o select pede (as relações vêm
  como objetos já guardados na linha; "!inner" ignora-se), aplica as escritas (insert, update, delete, upsert) e tem um
  armazenamento de arquivos (upload, download). Uma falha pode ser forçada por tabela e operação. Só para testes.
*/
type Linha = Record<string, unknown>;

function partes(s: string): string[] {
  const out: string[] = [];
  let nivel = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") nivel++;
    if (ch === ")") nivel--;
    if (ch === "," && nivel === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
const nomeDaColuna = (c: string) => c.split("(")[0].replace("!inner", "").trim();

export function criarBanco(inicial: Record<string, Linha[]> = {}) {
  const banco: Record<string, Linha[]> = { ...inicial };
  const arquivos = new Map<string, Uint8Array>();
  const falhas = new Set<string>();
  let seq = 0;
  const tabela = (nome: string) => {
    const filtros: ((l: Linha) => boolean)[] = [];
    let cols: string[] | null = null;
    let op: { t: "select" } | { t: "update"; v: Linha } | { t: "delete" } | { t: "insert"; v: Linha[] } | { t: "upsert"; v: Linha[] } = { t: "select" };
    let limite: number | null = null;
    const linhas = () => (banco[nome] ??= []);
    const projetar = (l: Linha) => {
      if (!cols || cols.includes("*")) return { ...l };
      const o: Linha = {};
      for (const c of cols) o[nomeDaColuna(c)] = l[nomeDaColuna(c)];
      return o;
    };
    const executar = (): { data: unknown; error: { code: string; message: string } | null } => {
      if (falhas.has(`${nome}:${op.t}`)) return { data: null, error: { code: "XX000", message: `falha forçada em ${nome}:${op.t}` } };
      if (op.t === "insert" || op.t === "upsert") {
        const novas = op.v.map((l) => ({ id: globalThis.crypto.randomUUID(), created_at: new Date(Date.now() + ++seq).toISOString(), criado_em: new Date(Date.now() + seq).toISOString(), lido_em: null, resolvido_em: null, ...l }));
        linhas().push(...novas);
        return { data: novas.map(projetar), error: null };
      }
      const alvo = linhas().filter((l) => filtros.every((f) => f(l)));
      if (op.t === "update") {
        for (const l of alvo) Object.assign(l, op.v);
        return { data: alvo.map(projetar), error: null };
      }
      if (op.t === "delete") {
        banco[nome] = linhas().filter((l) => !alvo.includes(l));
        return { data: null, error: null };
      }
      const r = alvo.map(projetar);
      return { data: limite == null ? r : r.slice(0, limite), error: null };
    };
    const q: Record<string, unknown> = {
      select(s?: string) {
        if (s) cols = partes(s);
        return q;
      },
      eq: (c: string, v: unknown) => (filtros.push((l) => l[c] === v), q),
      neq: (c: string, v: unknown) => (filtros.push((l) => l[c] !== v), q),
      in: (c: string, vs: unknown[]) => (filtros.push((l) => vs.includes(l[c])), q),
      is: (c: string, v: unknown) => (filtros.push((l) => (l[c] ?? null) === v), q),
      not: (c: string, o: string, v: unknown) => (filtros.push((l) => (o === "is" ? (l[c] ?? null) !== v : true)), q),
      gte: (c: string, v: string | number) => (filtros.push((l) => l[c] != null && (l[c] as string | number) >= v), q),
      lte: (c: string, v: string | number) => (filtros.push((l) => l[c] != null && (l[c] as string | number) <= v), q),
      lt: (c: string, v: string | number) => (filtros.push((l) => l[c] != null && (l[c] as string | number) < v), q),
      order: () => q,
      limit: (n: number) => ((limite = n), q),
      update: (v: Linha) => ((op = { t: "update", v }), q),
      delete: () => ((op = { t: "delete" }), q),
      insert: (v: Linha | Linha[]) => ((op = { t: "insert", v: Array.isArray(v) ? v : [v] }), q),
      upsert: (v: Linha | Linha[]) => ((op = { t: "upsert", v: Array.isArray(v) ? v : [v] }), q),
      maybeSingle: async () => {
        const r = executar();
        return r.error ? r : { data: Array.isArray(r.data) ? ((r.data as Linha[])[0] ?? null) : r.data, error: null };
      },
      single: async () => {
        const r = executar();
        return r.error ? r : { data: Array.isArray(r.data) ? ((r.data as Linha[])[0] ?? null) : r.data, error: null };
      },
      then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(executar()).then(ok, ko),
    };
    return q;
  };
  const storage = {
    from: (bucket: string) => ({
      upload: async (path: string, bytes: Uint8Array) => {
        if (falhas.has(`storage:${bucket}`)) return { data: null, error: { message: "falha forçada" } };
        arquivos.set(`${bucket}/${path}`, bytes);
        return { data: { path }, error: null };
      },
      remove: async (paths: string[]) => {
        for (const path of paths) arquivos.delete(`${bucket}/${path}`);
        return { data: paths.map((name) => ({ name })), error: null };
      },
      download: async (path: string) => {
        const b = arquivos.get(`${bucket}/${path}`);
        return b ? { data: new Blob([b as BlobPart]), error: null } : { data: null, error: { message: "não existe" } };
      },
    }),
  };
  const auth = { admin: { getUserById: async (id: string) => ({ data: { user: { id, email: `${id.slice(0, 8)}@teste.invalid` } }, error: null }) } };
  const rpc = async () => ({ data: null, error: null });
  return { banco, arquivos, falhas, admin: { from: tabela, storage, auth, rpc } };
}
