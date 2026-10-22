/*
  Minimização e eliminação automática (Prompt 58, fase 1) — regras PURAS.

  Princípio (regra do produto, aprovada pelo Daniel em 22/10): todo dado retido tem finalidade, prazo e gatilho de
  eliminação escritos; guarda-se o VEREDITO, não o material bruto. O inventário (src/config/retencao.ts) diz, para cada
  tabela e cada bucket com dado pessoal, o que é, para quê, por quanto tempo e o que dispara a eliminação.

  Fase 1: apaga DE VERDADE só o que não depende de prazo jurídico (base "proposta" †, prazo definido, fase 1).
  Todo o resto (base "pendente item 13" ou fase 2) roda em MODO SIMULADO: conta o que seria apagado hoje e não apaga.
*/

export type Modo = "apagar" | "anonimizar";
export type Base = "legal" | "proposta" | "pendente";
export type Gatilho =
  | "decisao_admin" // aprovado/recusado pelo admin (documento de /qualificar, matrícula/vínculo)
  | "recusa_dono" // candidatura recusada pelo dono (o documento da candidatura sai; fica o veredito)
  | "fim_estadia" // fim do contrato
  | "fim_janela_disputa" // fim da janela de disputa da estadia (prazo do item 13)
  | "exclusao_conta" // pedido de exclusão da conta / do titular
  | "sinal_processado" // depois de usado (ex.: medição do morador → sinal de qualidade)
  | "remocao_anuncio" // anúncio removido
  | "sem_gatilho_automatico"; // fica enquanto a conta existir; sai na exclusão da conta

export interface ItemInventario {
  /** Chave estável do item (vai ao livro e ao relatório). */
  id: string;
  /** Tabela (public.x) ou bucket (bucket:x). */
  origem: string;
  dado: string;
  finalidade: string;
  /** Dias depois do gatilho; null = prazo pendente (item 13) ou "enquanto a conta existir". */
  prazoDias: number | null;
  gatilho: Gatilho;
  modo: Modo;
  base: Base;
  fase: 1 | 2;
  /** O que fica depois de eliminar (o veredito), quando houver. */
  fica?: string;
}

const DIA = 86_400_000;

/** O item roda de verdade nesta fase? Só fase 1, com prazo definido e base que não dependa do jurídico. */
export function eliminaDeVerdade(item: Pick<ItemInventario, "fase" | "base" | "prazoDias">): boolean {
  return item.fase === 1 && item.base !== "pendente" && item.prazoDias !== null;
}

/**
 * Venceu? `desde` é o instante do gatilho (decisão do admin, fim da estadia…). Sai quando passaram MAIS que prazoDias
 * dias inteiros: com 30 dias, o dia 29 e o dia 30 ficam, o dia 31 sai.
 */
export function venceu(prazoDias: number | null, desde: string | Date | null | undefined, agora: Date): boolean {
  if (prazoDias === null || !desde) return false;
  const t = typeof desde === "string" ? Date.parse(desde) : desde.getTime();
  if (!Number.isFinite(t)) return false;
  return Math.floor((agora.getTime() - t) / DIA) > prazoDias;
}

export interface Candidato {
  ref: string;
  desde: string | null;
  teste?: boolean;
}

export interface Plano {
  item: string;
  real: boolean;
  /** Refs a eliminar (só no modo real). */
  eliminar: string[];
  /** Contagem do que seria eliminado (modo simulado e real). */
  quantidade: number;
  quantidadeTeste: number;
}

/** O plano do dia para um item: o que venceu; real só quando a fase permite, senão só a contagem. */
export function planoDoItem(item: ItemInventario, candidatos: readonly Candidato[], agora: Date): Plano {
  const vencidos = candidatos.filter((c) => venceu(item.prazoDias, c.desde, agora));
  const real = eliminaDeVerdade(item);
  return {
    item: item.id,
    real,
    eliminar: real ? vencidos.map((c) => c.ref) : [],
    quantidade: vencidos.filter((c) => !c.teste).length,
    quantidadeTeste: vencidos.filter((c) => c.teste).length,
  };
}

/** Texto do prazo para o relatório e para a tabela do inventário. */
export function textoPrazo(item: Pick<ItemInventario, "prazoDias" | "base" | "gatilho">): string {
  if (item.base === "pendente") return "pendente – item 13 da Dra. Beatriz";
  if (item.prazoDias === null) return "enquanto a conta existir";
  const quando: Record<Gatilho, string> = {
    decisao_admin: "depois da decisão do admin",
    recusa_dono: "depois da recusa da candidatura",
    fim_estadia: "depois do fim da estadia",
    fim_janela_disputa: "depois do fim da janela de disputa",
    exclusao_conta: "depois do pedido de exclusão",
    sinal_processado: "depois de processado o sinal",
    remocao_anuncio: "depois da remoção do anúncio",
    sem_gatilho_automatico: "",
  };
  const dias = item.prazoDias === 0 ? "na hora" : `${item.prazoDias} dias`;
  return `${dias} ${quando[item.gatilho]}${item.base === "proposta" ? " †" : ""}`.trim();
}

/**
 * Restauração de backup: depois de restaurar, o livro é reaplicado. Devolve, para cada origem, os refs do livro que
 * voltaram a existir (e que precisam sair de novo). O drill confere que a lista final é vazia.
 */
export function aReaplicar(livro: readonly { origem: string; ref_id: string }[], existentes: ReadonlyMap<string, ReadonlySet<string>>): { origem: string; ref: string }[] {
  return livro.filter((l) => existentes.get(l.origem)?.has(l.ref_id)).map((l) => ({ origem: l.origem, ref: l.ref_id }));
}
