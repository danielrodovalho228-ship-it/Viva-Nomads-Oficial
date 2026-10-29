/*
  QA-LOGIN-B v2 — regra pura do admin observador da QA (o servidor está em ./observador.ts).
  Roda: node --test src/lib/qa/observador-regras.test.ts
*/

export const MSG_OBSERVADOR =
  "Esta é a conta de QA (admin observador): ela só vê. Esta ação está fechada para ela — use uma conta de teste ou peça a alguém da equipe.";

/** O que a ação toca. Perfis diretos ou registros cujos donos o servidor descobre. `semPerfil`: alvos sem conta (ex.: pedido de parceria). */
export interface AlvoObservador {
  perfis?: (string | null | undefined)[];
  imoveis?: (string | null | undefined)[];
  pedidosMoradia?: (string | null | undefined)[];
  documentos?: (string | null | undefined)[];
  semPerfil?: number;
}

/**
 * Recusa ou segue. Quem não é observador sempre segue. Para o observador: sem alvo (`alvoTodoTeste` null) a ação é
 * proibida sempre; com alvo, só segue se tudo o que ela toca for de teste.
 */
export function decidirObservador(ehObservador: boolean, alvoTodoTeste: boolean | null): string | null {
  if (!ehObservador) return null;
  return alvoTodoTeste === true ? null : MSG_OBSERVADOR;
}

/** Leituras de que a decisão precisa (o servidor liga no banco; o teste, em dados falsos). */
export interface DepsObservador {
  qaAdmin(userId: string): Promise<boolean>;
  donos(tabela: "properties" | "pedidos_moradia" | "qualification_checklists", ids: string[]): Promise<string[]>;
  perfisTeste(ids: string[]): Promise<Set<string>>;
}

const limpos = (xs: (string | null | undefined)[] | undefined) => [...new Set((xs ?? []).filter((x): x is string => !!x))];

/**
 * A decisão inteira: quem não é observador segue; para o observador, sem alvo → recusa; com alvo → só segue se
 * todo perfil por trás dele for de teste. Alvo sem dono identificável (ou `semPerfil`) conta como real.
 */
export async function recusaComDeps(d: DepsObservador, userId: string | null | undefined, alvo?: AlvoObservador): Promise<string | null> {
  if (!userId || !(await d.qaAdmin(userId))) return null;
  if (!alvo) return decidirObservador(true, null);
  const perfis = new Set(limpos(alvo.perfis));
  let semDono = (alvo.semPerfil ?? 0) > 0;
  for (const [tabela, ids] of [
    ["properties", limpos(alvo.imoveis)],
    ["pedidos_moradia", limpos(alvo.pedidosMoradia)],
    ["qualification_checklists", limpos(alvo.documentos)],
  ] as const) {
    if (!ids.length) continue;
    const donos = await d.donos(tabela, ids);
    if (donos.length < ids.length) semDono = true;
    for (const x of donos) perfis.add(x);
  }
  if (semDono || perfis.size === 0) return decidirObservador(true, false);
  const teste = await d.perfisTeste([...perfis]);
  return decidirObservador(true, [...perfis].every((id) => teste.has(id)));
}

/** Uma linha de fila na tela e o que a ação dela toca (o mesmo alvo que a server action passa a recusaObservador). */
export interface LinhaDaTela {
  id: string;
  /** Sem alvo: a ação é proibida sempre para o observador (ex.: chave, suporte, interesse sem conta). */
  alvo?: AlvoObservador;
}

/** Chave do mapa de donos: `tabela:id`. */
export const chaveDono = (tabela: "properties" | "pedidos_moradia" | "qualification_checklists", id: string) => `${tabela}:${id}`;

/**
 * Pendência 3 do QA-LOGIN-B v2 — a tela espelha a recusa do servidor: para o admin observador, os ids das linhas em
 * que a ação seria recusada (dado real, alvo sem dono, ou sem alvo). Quem não é observador: nenhuma linha.
 * `donoDe`: `chaveDono(tabela, id)` → dono; `teste`: perfis is_teste.
 */
export function linhasSoLeitura(ehObservador: boolean, linhas: readonly LinhaDaTela[], donoDe: ReadonlyMap<string, string>, teste: ReadonlySet<string>): string[] {
  if (!ehObservador) return [];
  return linhas
    .filter(({ alvo }) => {
      if (!alvo) return true;
      const perfis = new Set(limpos(alvo.perfis));
      let semDono = (alvo.semPerfil ?? 0) > 0;
      for (const [tabela, ids] of [
        ["properties", limpos(alvo.imoveis)],
        ["pedidos_moradia", limpos(alvo.pedidosMoradia)],
        ["qualification_checklists", limpos(alvo.documentos)],
      ] as const) {
        for (const id of ids) {
          const dono = donoDe.get(chaveDono(tabela, id));
          if (dono) perfis.add(dono);
          else semDono = true;
        }
      }
      if (semDono || perfis.size === 0) return true;
      return ![...perfis].every((p) => teste.has(p));
    })
    .map((l) => l.id);
}
