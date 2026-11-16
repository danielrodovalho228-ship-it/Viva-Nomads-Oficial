/*
  T2072 — E966 parte 2 (Pista 3; autorizado pelo Gerente na ronda 03:20Z) @E966 (unitário, sem rede)
  Regra decidida (E444/E445; E966): a faixa vermelha e o "Crítico" do sino só somem quando o problema é RESOLVIDO — e
  todo aviso crítico tem de ter um caminho que o marque como resolvido. Sem caminho, o aviso fica crítico para sempre.
  A parte 1 (#3865) cobriu a proposta expirada. Esta trava cobre os 7 eventos críticos que hoje não têm caminho
  nenhum de resolução (lista da Pista 3), um teste nomeado por evento:
    estadia_encerramento_pedido, documento_recusado, checklist_recusado, manutencao_atrasada, vistoria_fora_da_busca,
    pedido_confirmar_telefone, manutencao_nova (crítico para o dono).
  O que conta como "caminho de resolução" (lido do código de produção, sem os testes):
    - o evento vai em `eventos` de uma chamada a resolverAvisos(...) — em lista literal (com `...CONSTANTE`) ou numa constante;
    - o evento é filtrado num update que preenche `resolvido_em` (`.in("evento", …)` / `.eq("evento", "…")`);
    - o evento tem ação em ACAO_RESOLVE;
    - o evento é tratado em resolvidosNaPratica (sino.ts), que dá o aviso por resolvido pela situação real.
  A leitura é validada primeiro: os 5 críticos que já se resolvem hoje têm de ser achados (senão a trava seria vazia).
  Ponto de adaptação: se a correção criar outro mecanismo de resolução, acrescentá-lo aqui (com o julgamento registado).
  Correção do Code 2 (E966 parte 2). Vermelha na main até a correção entrar.
  Roda: node --test src/lib/notifications/e966-t2072-criticos-com-resolucao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ACAO_RESOLVE, prioridadeDoAviso } from "./avisos.ts";

function arquivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...arquivos(p));
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) && !/-harness\//.test(p)) out.push(p);
  }
  return out;
}

const FONTES = arquivos("src").map((f) => ({ f, s: readFileSync(f, "utf8") }));
const strings = (lista: string) => [...lista.matchAll(/["'`](\w+)["'`]/g)].map((m) => m[1]);

// Constantes de lista de eventos (const X = [...] / export const X: T[] = [...]).
const CONSTANTES = new Map<string, string[]>();
for (const { s } of FONTES)
  for (const m of s.matchAll(/(?:export\s+)?const\s+(\w+)\s*(?::[^=\n]+)?=\s*(\[[^\]]*\])/g)) CONSTANTES.set(m[1], strings(m[2]));
// Lista literal (com strings e espalhamentos `...CONSTANTE`) ou o nome de uma constante.
const expandir = (expr: string): string[] => {
  const e = expr.trim();
  if (!e.startsWith("[")) return CONSTANTES.get(e) ?? [];
  return [...strings(e), ...[...e.matchAll(/\.\.\.(\w+)/g)].flatMap((m) => CONSTANTES.get(m[1]) ?? [])];
};

function eventosComResolucao(): Map<string, string> {
  const onde = new Map<string, string>();
  const marca = (ev: string, como: string) => onde.has(ev) || onde.set(ev, como);
  for (const { f, s } of FONTES) {
    // 1. resolverAvisos({ … eventos: [...] | CONSTANTE … })
    for (const m of s.matchAll(/resolverAvisos\(\s*\{[^}]*?\beventos:\s*(\[[^\]]*\]|\w+)/g)) for (const ev of expandir(m[1])) marca(ev, `resolverAvisos em ${f}`);
    // 2. update({ resolvido_em … }) com filtro de evento logo a seguir.
    for (const m of s.matchAll(/resolvido_em\s*:/g)) {
      const janela = s.slice(m.index!, m.index! + 500);
      for (const x of janela.matchAll(/\.in\(\s*["']evento["']\s*,\s*(\[[^\]]*\]|\w+)\s*\)/g)) for (const ev of expandir(x[1])) marca(ev, `update de resolvido_em em ${f}`);
      for (const x of janela.matchAll(/\.eq\(\s*["']evento["']\s*,\s*["'](\w+)["']\s*\)/g)) marca(x[1], `update de resolvido_em em ${f}`);
    }
  }
  // 3. ACAO_RESOLVE.
  for (const ev of Object.keys(ACAO_RESOLVE)) marca(ev, "ACAO_RESOLVE");
  // 4. resolvidosNaPratica (o aviso é dado por resolvido pela situação real).
  const sino = readFileSync("src/lib/notifications/sino.ts", "utf8");
  const corpo = sino.slice(sino.indexOf("export function resolvidosNaPratica"));
  for (const m of corpo.slice(0, corpo.indexOf("\n}\n") + 1).matchAll(/evento\s*===\s*["'](\w+)["']/g)) marca(m[1], "resolvidosNaPratica");
  return onde;
}

const RESOLVIDOS = eventosComResolucao();

test("T2072 — E966: a leitura acha os críticos que já se resolvem hoje (a trava não é vazia)", () => {
  for (const ev of ["contract_status", "proposta_recebida", "proposta_vencendo", "visita_pedida", "estadia_aditivo_proposto"])
    assert.ok(RESOLVIDOS.has(ev), `${ev} já tem caminho de resolução na main e a leitura não o achou`);
});

const SETE: { evento: string; papel?: "dono" }[] = [
  { evento: "estadia_encerramento_pedido" },
  { evento: "documento_recusado" },
  { evento: "checklist_recusado" },
  { evento: "manutencao_atrasada" },
  { evento: "vistoria_fora_da_busca" },
  { evento: "pedido_confirmar_telefone" },
  { evento: "manutencao_nova", papel: "dono" },
];

for (const { evento, papel } of SETE) {
  test(`T2072 — E966: ${evento}${papel ? ` (${papel})` : ""} é crítico e tem caminho de resolução`, () => {
    assert.equal(prioridadeDoAviso(evento as never, papel ?? null), "critico", `${evento} deixou de ser crítico — rever a lista com o Gerente`);
    assert.ok(RESOLVIDOS.has(evento), `${evento}: aviso crítico sem nenhum caminho que preencha resolvido_em (fica crítico para sempre)`);
  });
}
