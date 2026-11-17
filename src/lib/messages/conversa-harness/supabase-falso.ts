/*
  Harness de teste (Pista 3, lote 2 — conversas e anexos): Supabase em memória com o pedaço da API que
  listConversations e a rota de anexo usam (select/insert/delete + eq/in/or/order/limit + single/maybeSingle/then, rpc,
  auth.getUser e storage). Os filtros são aplicados de verdade (o `.or("a.eq.x,b.eq.y")` faz o papel da RLS de leitura).
  Guarda o que foi gravado e apagado, para o teste provar que nada fica órfão. Não entra no app; só os testes o importam.
*/
import { register } from "node:module";

register("./loader.mjs", import.meta.url);

type Linha = Record<string, unknown>;
type Filtro = (l: Linha) => boolean;

function cliente(tabelas: Record<string, Linha[]>, registro: Registro, userId: string | null) {
  function from(tabela: string) {
    const filtros: Filtro[] = [];
    let acao: "select" | "insert" | "delete" = "select";
    let novos: Linha[] = [];
    let limite = Infinity;
    const executar = () => {
      const t = (tabelas[tabela] ??= []);
      if (registro.falhar.has(`${acao}:${tabela}`)) return { data: null, error: { message: `falha simulada em ${acao}:${tabela}` } };
      if (acao === "insert") {
        const gravados = novos.map((n) => ({ id: n.id ?? `${tabela}-${t.length + 1}`, ...n }));
        t.push(...gravados);
        registro.inseridos.push(...gravados.map((g) => ({ tabela, linha: g })));
        return { data: gravados.map((g) => ({ ...g })), error: null };
      }
      const achadas = t.filter((l) => filtros.every((f) => f(l)));
      if (acao === "delete") {
        tabelas[tabela] = t.filter((l) => !achadas.includes(l));
        registro.apagados.push(...achadas.map((a) => ({ tabela, linha: a })));
        return { data: achadas, error: null };
      }
      return { data: achadas.slice(0, limite).map((l) => ({ ...l })), error: null };
    };
    const b = {
      select: () => b,
      insert: (v: Linha | Linha[]) => ((acao = "insert"), (novos = Array.isArray(v) ? v : [v]), b),
      delete: () => ((acao = "delete"), b),
      eq: (c: string, v: unknown) => (filtros.push((l) => l[c] === v), b),
      in: (c: string, vs: unknown[]) => (filtros.push((l) => vs.includes(l[c])), b),
      or: (expr: string) => {
        const partes = expr.split(",").map((p) => p.split(".eq."));
        filtros.push((l) => partes.some(([c, v]) => l[c] === v));
        return b;
      },
      order: () => b,
      limit: (n: number) => ((limite = n), b),
      single: async () => {
        const r = executar();
        return Array.isArray(r.data) && r.data.length ? { data: r.data[0], error: null } : { data: null, error: r.error ?? { message: "nenhuma linha" } };
      },
      maybeSingle: async () => {
        const r = executar();
        return { data: Array.isArray(r.data) ? (r.data[0] ?? null) : null, error: r.error };
      },
      then: (ok: (r: unknown) => unknown, erro?: (e: unknown) => unknown) => Promise.resolve(executar()).then(ok, erro),
    };
    return b;
  }
  return {
    from,
    rpc: async () => ({ data: [], error: null }),
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    storage: {
      from: (bucket: string) => ({
        upload: async (caminho: string, bytes: Uint8Array, opcoes: { contentType: string }) => {
          if (registro.falhar.has("upload")) return { error: { message: "falha simulada no upload" } };
          registro.arquivos.set(`${bucket}/${caminho}`, { bytes, contentType: opcoes.contentType });
          return { error: null };
        },
        remove: async (caminhos: string[]) => {
          for (const c of caminhos) registro.arquivos.delete(`${bucket}/${c}`);
          return { error: null };
        },
      }),
    },
  };
}

export interface Registro {
  inseridos: { tabela: string; linha: Linha }[];
  apagados: { tabela: string; linha: Linha }[];
  arquivos: Map<string, { bytes: Uint8Array; contentType: string }>;
  /** "insert:messages", "insert:mensagens_anexos", "upload"… */
  falhar: Set<string>;
}

/** Monta a sessão de `userId` (cliente do usuário) e o cliente de serviço sobre as MESMAS tabelas. */
export function novoMundo(tabelas: Record<string, Linha[]>, userId: string | null, opcoes: { servico?: boolean } = {}) {
  const registro: Registro = { inseridos: [], apagados: [], arquivos: new Map(), falhar: new Set() };
  const g = globalThis as unknown as { __CONVERSA: Record<string, unknown> };
  g.__CONVERSA = {
    sessao: cliente(tabelas, registro, userId),
    servico: opcoes.servico === false ? null : cliente(tabelas, registro, null),
    limites: [] as string[],
    limiteLivre: true,
  };
  return { tabelas, registro, estado: g.__CONVERSA as { limites: string[]; limiteLivre: boolean } };
}

/** UUIDs fixos, legíveis nos testes. */
export const U = {
  morador: "11111111-1111-4111-8111-111111111111",
  dono: "22222222-2222-4222-8222-222222222222",
  outro: "33333333-3333-4333-8333-333333333333",
  imovel: "44444444-4444-4444-8444-444444444444",
  imovel2: "55555555-5555-4555-8555-555555555555",
};
