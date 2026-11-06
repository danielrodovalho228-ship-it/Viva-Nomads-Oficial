/*
  Banco falso em memória para os testes de fluxo (E640): tabelas = listas de linhas, com o suficiente do cliente do Supabase
  (select/eq/in/is/not/like/order/limit/maybeSingle/insert/update/upsert/rpc/storage). Tabela que o teste não povoou lê vazia.
  Não interpreta SQL: as funções do banco (rpc) o teste informa.
*/
type Linha = Record<string, unknown>;
type Filtro = (l: Linha) => boolean;
export interface Armazenamento {
  /** bucket → caminho → bytes */
  [bucket: string]: Record<string, Uint8Array>;
}

export class BancoFalso {
  tabelas: Record<string, Linha[]> = {};
  rpcs: Record<string, (args: Record<string, unknown>) => unknown[]> = {};
  arquivos: Armazenamento = {};
  /** Usuário logado do cliente RLS; vazio = anônimo. */
  uid: string | null = null;
  /** RLS: devolve só as linhas que o usuário pode enxergar (tabela → regra). Sem regra = tudo. */
  rls: Record<string, (l: Linha, uid: string | null) => boolean> = {};
  perfis: Record<string, { full_name: string }> = {};

  tabela(nome: string): Linha[] {
    return (this.tabelas[nome] ??= []);
  }

  from(nome: string, comoUsuario = false) {
    return new Consulta(this, nome, comoUsuario);
  }

  rpc(nome: string, args: Record<string, unknown>) {
    const f = this.rpcs[nome];
    return Promise.resolve(f ? { data: f(args), error: null } : { data: null, error: { message: `rpc ${nome} não existe` } });
  }

  /** O cliente de serviço (ignora RLS). */
  servico() {
    return {
      from: (n: string) => this.from(n),
      rpc: (n: string, a: Record<string, unknown>) => this.rpc(n, a),
      storage: { from: (b: string) => this.bucket(b) },
    };
  }

  /** O cliente da pessoa logada (aplica a RLS). */
  usuario(uid: string | null) {
    return {
      auth: { getUser: async () => ({ data: { user: uid ? { id: uid } : null }, error: null }) },
      from: (n: string) => this.from(n, true).comUid(uid),
    };
  }

  private bucket(b: string) {
    return {
      download: async (caminho: string) => {
        const bytes = this.arquivos[b]?.[caminho];
        return bytes ? { data: { arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }, error: null } : { data: null, error: { message: "não achou" } };
      },
    };
  }
}

class Consulta implements PromiseLike<{ data: unknown; error: { message: string } | null }> {
  private filtros: Filtro[] = [];
  private op: "select" | "update" | "insert" | "upsert" | "delete" = "select";
  private valores: Linha | Linha[] | null = null;
  private ignorarDuplicados = false;
  private chaveConflito: string[] = [];
  private maximo = Infinity;
  private uid: string | null = null;
  private banco: BancoFalso;
  private nome: string;
  private rls: boolean;
  constructor(banco: BancoFalso, nome: string, rls: boolean) {
    this.banco = banco;
    this.nome = nome;
    this.rls = rls;
  }
  comUid(uid: string | null) {
    this.uid = uid;
    return this;
  }
  select() {
    return this;
  }
  eq(c: string, v: unknown) {
    this.filtros.push((l) => l[c] === v);
    return this;
  }
  in(c: string, vs: unknown[]) {
    this.filtros.push((l) => vs.includes(l[c]));
    return this;
  }
  is(c: string, v: null) {
    this.filtros.push((l) => (l[c] ?? null) === v);
    return this;
  }
  not(c: string, op: string, v: unknown) {
    if (op === "is") this.filtros.push((l) => (l[c] ?? null) !== v);
    return this;
  }
  like() {
    return this;
  }
  contains() {
    return this;
  }
  order() {
    return this;
  }
  limit(n: number) {
    this.maximo = n;
    return this;
  }
  insert(v: Linha | Linha[]) {
    this.op = "insert";
    this.valores = v;
    return this;
  }
  update(v: Linha) {
    this.op = "update";
    this.valores = v;
    return this;
  }
  upsert(v: Linha | Linha[], o: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.op = "upsert";
    this.valores = v;
    this.ignorarDuplicados = !!o.ignoreDuplicates;
    this.chaveConflito = (o.onConflict ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    return this;
  }
  private linhas() {
    let ls = this.banco.tabela(this.nome).filter((l) => this.filtros.every((f) => f(l)));
    const regra = this.rls ? this.banco.rls[this.nome] : undefined;
    if (regra) ls = ls.filter((l) => regra(l, this.uid));
    return ls.slice(0, this.maximo);
  }
  private executar(): { data: unknown; error: null } {
    const tabela = this.banco.tabela(this.nome);
    if (this.op === "insert") {
      tabela.push(...([] as Linha[]).concat(this.valores as Linha[]).map((v) => ({ ...v })));
      return { data: null, error: null };
    }
    if (this.op === "upsert") {
      for (const v of ([] as Linha[]).concat(this.valores as Linha[])) {
        const ja = tabela.find((l) => this.chaveConflito.length && this.chaveConflito.every((c) => l[c] === v[c]));
        if (ja) {
          if (!this.ignorarDuplicados) Object.assign(ja, v);
        } else tabela.push({ ...v });
      }
      return { data: null, error: null };
    }
    if (this.op === "update") {
      for (const l of this.linhas()) Object.assign(l, this.valores);
      return { data: null, error: null };
    }
    return { data: this.linhas(), error: null };
  }
  maybeSingle() {
    const r = this.executar();
    return Promise.resolve({ data: (r.data as Linha[])[0] ?? null, error: null });
  }
  then<A, B>(ok?: ((v: { data: unknown; error: { message: string } | null }) => A | PromiseLike<A>) | null, no?: ((r: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve(this.executar()).then(ok, no);
  }
}
