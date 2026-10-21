/*
  Resiliência 2 — as comparações do teste de restauração (puro). scripts/drill/conferir.ts lê o banco restaurado e o
  storage e chama estas funções. Nenhuma devolve dado de linha nem nome de arquivo: só nomes de tabela, números de
  migração e contagens.
  Roda: node --test src/lib/backup/backup.test.ts
*/
import type { Manifesto } from "./manifesto.ts";
import { ROTULO_CONSULTA, type NomeConsultaChave } from "./consultas-chave.ts";

export const TAMANHO_AMOSTRA = 20;
/** O "MINIMA" de scripts/aplicar-migracoes.sh: daqui para frente todo aplicar-NNNN.sql se registra como "NNNN_…". */
export const PRIMEIRA_MIGRACAO_REGISTRADA = 76;

export interface Conferencia {
  nome: string;
  ok: boolean;
  /** Números e nomes técnicos, nunca dado. */
  detalhe: string;
}

export function compararContagens(esperado: Record<string, number>, restaurado: Record<string, number>): Conferencia {
  const diferentes = Object.keys(esperado)
    .filter((t) => restaurado[t] !== esperado[t])
    .sort();
  const total = Object.keys(esperado).length;
  return {
    nome: "Linhas por tabela = manifesto",
    ok: total > 0 && diferentes.length === 0,
    detalhe:
      total === 0
        ? "o manifesto não tem tabelas"
        : diferentes.length === 0
          ? `${total} tabelas iguais ao manifesto`
          : `${diferentes.length} de ${total} tabelas diferentes: ${diferentes.slice(0, 10).join(", ")}${diferentes.length > 10 ? "…" : ""}`,
  };
}

/** Número da migração ("20261019000186 0186_cartoes…" ou "0186_cartoes…") → 186; null se não tiver. */
export function numeroMigracao(registro: string): number | null {
  const nome = registro.includes(" ") ? registro.slice(registro.indexOf(" ") + 1) : registro;
  const m = /^(\d{4})_/.exec(nome);
  return m ? Number(m[1]) : null;
}

/**
 * Migrações: as do restaurado = as do manifesto (mesma lista); e as do repositório (aplicar-NNNN.sql a partir da 0076)
 * até a última registrada estão todas lá. Uma migração do repositório mais nova que o backup não conta (ainda não
 * tinha sido aplicada naquela noite).
 */
export function compararMigracoes(manifesto: readonly string[], restaurado: readonly string[], repositorio: readonly number[]): Conferencia {
  const a = [...manifesto].sort();
  const b = [...restaurado].sort();
  const iguais = a.length === b.length && a.every((x, i) => x === b[i]);
  const registradas = new Set(b.map(numeroMigracao).filter((n): n is number => n !== null));
  const maior = Math.max(0, ...registradas);
  const faltando = [...new Set(repositorio)].filter((n) => n >= PRIMEIRA_MIGRACAO_REGISTRADA && n <= maior && !registradas.has(n)).sort((x, y) => x - y);
  const ok = iguais && b.length > 0 && faltando.length === 0;
  const partes = [
    iguais ? `${b.length} migrações iguais ao manifesto` : `restaurado tem ${b.length} migrações, o manifesto ${a.length}`,
    faltando.length ? `do repositório faltam: ${faltando.map((n) => String(n).padStart(4, "0")).join(", ")}` : `última: ${String(maior).padStart(4, "0")}`,
  ];
  return { nome: "Migrações registradas = repositório", ok, detalhe: partes.join("; ") };
}

/** respostas[k] = null quando a consulta deu erro. */
export function conferirChaves(manifesto: Manifesto["chaves"], respostas: Record<NomeConsultaChave, boolean | null>): Conferencia[] {
  return (Object.keys(ROTULO_CONSULTA) as NomeConsultaChave[]).map((k) => {
    const r = respostas[k];
    const esperado = manifesto[k];
    const ok = r !== null && r !== undefined && (esperado !== true || r === true);
    const detalhe =
      r === null || r === undefined
        ? "a consulta deu erro"
        : r
          ? "respondeu e achou"
          : esperado === true
            ? "respondeu, mas não achou o que a produção tinha"
            : "respondeu (a produção também não tinha)";
    return { nome: `Consulta-chave: ${ROTULO_CONSULTA[k]}`, ok, detalhe };
  });
}

/** Sorteia n itens sem repetição (Fisher–Yates parcial). `aleatorio` devolve [0, 1). */
export function sortearAmostra<T>(lista: readonly T[], n: number, aleatorio: () => number): T[] {
  const c = [...lista];
  const k = Math.min(n, c.length);
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(aleatorio() * (c.length - i));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c.slice(0, k);
}

/**
 * Lê o arquivo de `rclone check --combined`: "= caminho" bate; "*", "-", "+", "!" não. Devolve só as contagens.
 */
export function lerCheckCombinado(texto: string): { iguais: number; diferentes: number } {
  let iguais = 0;
  let diferentes = 0;
  for (const l of texto.split("\n")) {
    if (!l.trim()) continue;
    if (l.startsWith("= ")) iguais++;
    else diferentes++;
  }
  return { iguais, diferentes };
}

export function conferirAmostra(sorteados: number, r: { iguais: number; diferentes: number }, falhou: boolean): Conferencia {
  const ok = !falhou && sorteados > 0 && r.iguais === sorteados && r.diferentes === 0;
  return {
    nome: `Amostra de ${TAMANHO_AMOSTRA} objetos do storage (baixados, decifrados, tamanho e hash)`,
    ok,
    detalhe: sorteados === 0 ? "nenhum objeto no backup para sortear" : `${r.iguais} de ${sorteados} iguais ao Supabase${r.diferentes ? `, ${r.diferentes} diferentes` : ""}`,
  };
}

/** O motivo curto da linha em backups_execucoes: as conferências que falharam, só pelo nome. */
export function motivoDoDrill(c: readonly Conferencia[]): string | null {
  const falhas = c.filter((x) => !x.ok).map((x) => x.nome);
  return falhas.length ? `Não bateu: ${falhas.join("; ")}`.slice(0, 300) : null;
}
