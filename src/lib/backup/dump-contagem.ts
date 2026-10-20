/*
  Resiliência 2 — contagem de linhas por tabela LIDA DO PRÓPRIO DUMP (puro, sem I/O).
  A cópia noturna passa `pg_restore --data-only -f - <dump>` por aqui: cada bloco "COPY schema.tabela (…) FROM stdin;"
  termina em "\." e cada linha no meio é uma linha da tabela (no formato texto do COPY, quebra de linha dentro de um
  valor vira "\n", então linha = registro). Assim a contagem do manifesto é a do instante do dump, sem corrida com
  quem está gravando no banco, e o teste de restauração prova que o restaurado tem exatamente isso.
  Nenhum valor de coluna sai daqui, com UMA exceção sem dado pessoal: version e name de
  supabase_migrations.schema_migrations (a lista de migrações aplicadas).
  Roda: node --test src/lib/backup/backup.test.ts
*/

export interface ContagemDump {
  /** "schema.tabela" → linhas. */
  tabelas: Record<string, number>;
  /** Migrações registradas no dump: "versão nome", em ordem de versão. */
  migracoes: string[];
}

const RE_COPY = /^COPY ((?:"[^"]+"|[a-z_][a-z0-9_$]*))\.((?:"[^"]+"|[a-z_][a-z0-9_$]*)) \(([^)]*)\) FROM stdin;$/i;
const tiraAspas = (s: string) => (s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1).replace(/""/g, '"') : s);

/** Desfaz o escape do formato texto do COPY só no necessário para version/name (sem tab nem quebra). */
function valorCopy(v: string | undefined): string | null {
  if (v === undefined || v === "\\N") return null;
  return v.replace(/\\\\/g, "\\");
}

export class ContadorDump {
  private tabelas: Record<string, number> = {};
  private migracoes: string[] = [];
  private atual: string | null = null;
  private colVersao = -1;
  private colNome = -1;

  linha(l: string): void {
    if (this.atual === null) {
      const m = RE_COPY.exec(l);
      if (!m) return;
      this.atual = `${tiraAspas(m[1])}.${tiraAspas(m[2])}`;
      this.tabelas[this.atual] = this.tabelas[this.atual] ?? 0;
      if (this.atual === "supabase_migrations.schema_migrations") {
        const cols = m[3].split(",").map((c) => tiraAspas(c.trim()));
        this.colVersao = cols.indexOf("version");
        this.colNome = cols.indexOf("name");
      } else {
        this.colVersao = this.colNome = -1;
      }
      return;
    }
    if (l === "\\.") {
      this.atual = null;
      return;
    }
    this.tabelas[this.atual]++;
    if (this.colVersao >= 0) {
      const partes = l.split("\t");
      const versao = valorCopy(partes[this.colVersao]);
      const nome = this.colNome >= 0 ? valorCopy(partes[this.colNome]) : null;
      if (versao) this.migracoes.push(`${versao} ${nome ?? ""}`.trim());
    }
  }

  resultado(): ContagemDump {
    const tabelas: Record<string, number> = {};
    for (const k of Object.keys(this.tabelas).sort()) tabelas[k] = this.tabelas[k];
    return { tabelas, migracoes: [...this.migracoes].sort() };
  }
}

/** Conveniência para teste: conta um texto inteiro. */
export function contarDump(texto: string): ContagemDump {
  const c = new ContadorDump();
  for (const l of texto.split("\n")) c.linha(l);
  return c.resultado();
}
