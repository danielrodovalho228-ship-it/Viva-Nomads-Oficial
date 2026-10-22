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

/*
  Prompt 58 — o livro de eliminações reaplicado depois da restauração. O backup é de antes de algumas eliminações:
  o que o livro diz que saiu não pode voltar com a restauração. O livro (origem, ref) entra numa tabela temporária
  _livro do banco restaurado; SQL_LIVRO_VOLTOU conta o que voltou, SQL_LIVRO_REAPLICAR elimina de novo e a segunda
  contagem tem de dar zero. Toda eliminação real da fase 1 é de arquivo (origem "bucket:<bucket>", ref = caminho).
*/
const VOLTOU = [
  "select o.name from storage.objects o join _livro l on l.origem = 'bucket:' || o.bucket_id and l.ref = o.name",
  "select d.caminho from public.documentos_inquilino d join _livro l on l.origem = 'bucket:inquilino-docs' and l.ref = d.caminho",
  "select q.document_path from public.qualification_checklists q join _livro l on l.origem = 'bucket:property-docs' and l.ref = q.document_path",
  "select p.arquivo_path from public.property_ownership_checks p join _livro l on l.origem = 'bucket:property-docs' and l.ref in (p.arquivo_path, p.caso_documento_path)",
  "select f.url from public.property_photos f join _livro l on l.origem = 'bucket:property-photos' and f.url like '%/property-photos/' || l.ref",
];
export const SQL_LIVRO_VOLTOU = `select count(*) from (${VOLTOU.join(" union all ")}) x`;

export const SQL_LIVRO_REAPLICAR = [
  "delete from storage.objects o using _livro l where l.origem = 'bucket:' || o.bucket_id and l.ref = o.name",
  "update public.documentos_inquilino d set caminho = null, arquivo_eliminado_em = coalesce(d.arquivo_eliminado_em, now()) from _livro l where l.origem = 'bucket:inquilino-docs' and l.ref = d.caminho",
  "update public.qualification_checklists q set document_path = null, document_eliminado_em = coalesce(q.document_eliminado_em, now()) from _livro l where l.origem = 'bucket:property-docs' and l.ref = q.document_path",
  "update public.property_ownership_checks p set arquivo_path = null, caso_documento_path = null, arquivo_eliminado_em = coalesce(p.arquivo_eliminado_em, now()) from _livro l where l.origem = 'bucket:property-docs' and l.ref in (p.arquivo_path, p.caso_documento_path)",
  "delete from public.property_photos f using _livro l where l.origem = 'bucket:property-photos' and f.url like '%/property-photos/' || l.ref",
].join(";\n");

/** Linhas "origem|ref" do livro (saída -At do psql), sem linha vazia nem ref fora do formato de caminho. */
export function lerLivro(saida: string): { origem: string; ref: string }[] {
  return saida
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf("|");
      return { origem: l.slice(0, i), ref: l.slice(i + 1) };
    })
    .filter((x) => /^bucket:[a-z0-9-]+$/.test(x.origem) && /^[A-Za-z0-9._/-]{1,300}$/.test(x.ref) && !x.ref.includes(".."));
}

export function conferirLivro(entradas: number, voltaram: number | null, depois: number | null, preLivro: boolean): Conferencia {
  const nome = "Livro de eliminações reaplicado (nada eliminado volta)";
  if (preLivro) return { nome, ok: true, detalhe: "dump anterior ao livro (0206): nada a reaplicar" };
  if (voltaram === null || depois === null) return { nome, ok: false, detalhe: "não foi possível reaplicar o livro no restaurado" };
  return {
    nome,
    ok: depois === 0,
    detalhe: `${entradas} no livro; ${voltaram} voltaram com o backup e saíram de novo; ${depois} depois de reaplicar`,
  };
}
