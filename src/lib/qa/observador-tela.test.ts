/*
  Pendência 3 do QA-LOGIN-B v2 — a tela espelha a recusa do servidor: o admin observador da QA não vê os botões das
  linhas de dado real; nas de teste continuam. Regra pura com dados falsos + guarda de cada fila.
  Roda: node --test src/lib/qa/observador-tela.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { chaveDono, linhasSoLeitura, type LinhaDaTela } from "./observador-regras.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

const TESTE = new Set(["dono-teste", "morador-teste"]);
const DONO = new Map([
  [chaveDono("properties", "imovel-teste"), "dono-teste"],
  [chaveDono("properties", "imovel-real"), "dono-real"],
  [chaveDono("pedidos_moradia", "pedido-teste"), "morador-teste"],
  [chaveDono("qualification_checklists", "doc-teste"), "dono-teste"],
  [chaveDono("qualification_checklists", "doc-real"), "dono-real"],
]);

const LINHAS: LinhaDaTela[] = [
  { id: "a", alvo: { imoveis: ["imovel-teste"] } },
  { id: "b", alvo: { imoveis: ["imovel-real"] } },
  { id: "c", alvo: { pedidosMoradia: ["pedido-teste"] } },
  { id: "d", alvo: { documentos: ["doc-real"] } },
  { id: "e", alvo: { documentos: ["doc-teste"] } },
  { id: "f", alvo: { perfis: ["dono-teste"], imoveis: ["imovel-teste"] } },
  { id: "g", alvo: { perfis: ["dono-teste"], imoveis: ["imovel-real"] } },
  { id: "h", alvo: { imoveis: ["sumiu"] } },
  { id: "i", alvo: { perfis: [null], semPerfil: 1 } },
  { id: "j", alvo: {} },
  { id: "k" },
];

test("quem não é observador: nenhuma linha fica só leitura", () => {
  assert.deepEqual(linhasSoLeitura(false, LINHAS, DONO, TESTE), []);
});

test("observador: só leitura no dado real, sem dono, sem conta ou sem alvo; teste segue com os botões", () => {
  assert.deepEqual(linhasSoLeitura(true, LINHAS, DONO, TESTE), ["b", "d", "g", "h", "i", "j", "k"]);
});

test("a regra da tela é a mesma do servidor (recusaComDeps) para cada linha", async () => {
  const { recusaComDeps } = await import("./observador-regras.ts");
  const deps = {
    qaAdmin: async (u: string) => u === "obs",
    donos: async (tabela: "properties" | "pedidos_moradia" | "qualification_checklists", ids: string[]) =>
      ids.map((id) => DONO.get(chaveDono(tabela, id))).filter((x): x is string => !!x),
    perfisTeste: async (ids: string[]) => new Set(ids.filter((i) => TESTE.has(i))),
  };
  const tela = new Set(linhasSoLeitura(true, LINHAS, DONO, TESTE));
  for (const l of LINHAS) {
    const recusa = await recusaComDeps(deps, "obs", l.alvo);
    assert.equal(tela.has(l.id), recusa !== null, `linha ${l.id}`);
  }
});

test("GUARDA: cada fila com ação recusada pelo servidor tira os botões do observador", () => {
  const telas: [string, RegExp[]][] = [
    ["../../app/(dashboard)/admin/documentos/page.tsx", [/soLeituraNaTela\(\[/, /alvo: \{ documentos: \[d\.id\] \}/, /alvo: \{ perfis: \[m\.userId\], imoveis: \[m\.propertyId\] \}/]],
    ["../../app/(dashboard)/admin/documentos/admin-documentos-client.tsx", [/soLeitura \? \(\s*<SoLeituraQa/, /\{soLeitura \? <SoLeituraQa \/> : \(\s*<Button/]],
    ["../../app/(dashboard)/admin/documentos/matriculas-admin-client.tsx", [/\{soLeitura \? <SoLeituraQa className="mt-3" \/> : \(/]],
    ["../../components/admin/verificacoes-revisao.tsx", [/alvo: \{ perfis: \[l\.user_id\] \}/, /soLeitura\.includes\(l\.id\) \? <SoLeituraQa/]],
    ["../../app/(dashboard)/admin/pedidos/page.tsx", [/alvo: \{ pedidosMoradia: \[String\(x\.id\)\] \}/, /soLeitura=\{soLeitura\}/]],
    ["../../app/(dashboard)/admin/pedidos/admin-pedidos-client.tsx", [/soLeitura\.includes\(p\.id\) \? \(\s*<SoLeituraQa/]],
    ["../../app/(dashboard)/admin/imoveis/page.tsx", [/alvo: \{ imoveis: \[i\.id\] \}/, /soLeitura\.has\(i\.id\) \? <SoLeituraQa \/> : <PausarImovel/]],
    ["../../app/(dashboard)/admin/fotos-perfil/page.tsx", [/alvo: \{ perfis: \[f\.userId\] \}/, /<FilaFotosCliente fila=\{fila\} soLeitura=\{soLeitura\} \/>/]],
    ["../../app/(dashboard)/admin/fotos-perfil/fila-fotos-cliente.tsx", [/\{soLeitura \? \(\s*<SoLeituraQa/]],
    ["../../app/(dashboard)/admin/parceiros/page.tsx", [/semPerfil: uid \? 0 : 1/, /\{ id: SUPORTE \}/, /<SuporteForm soLeitura=\{observador\} \/>/]],
    ["../../app/(dashboard)/admin/parceiros/fichas.tsx", [/\{soLeitura \? <SoLeituraQa className="mt-4" \/> : \(/, /\{soLeitura \? <SoLeituraQa \/> : \(\s*<ConfirmarNaPagina aviso="Mandar um novo link/, /!soLeitura && \(\s*<div className="flex flex-wrap items-center gap-2">/, /if \(soLeitura\) return <SoLeituraQa \/>;/]],
    ["../../app/(dashboard)/admin/atendimento/[id]/page.tsx", [/soLeituraNaTela\(\[\{ id \}\]\)/, /observadorQa=\{observadorQa\}/]],
    ["../../app/(dashboard)/admin/atendimento/[id]/denuncia-nota.tsx", [/if \(soLeitura\) return <SoLeituraQa className="mt-3" \/>;/]],
  ];
  for (const [arq, res] of telas) {
    const src = ler(arq);
    for (const re of res) assert.match(src, re, `${arq}: ${re}`);
  }
});

test("GUARDA: a tela só esconde — as ações seguem recusando no servidor, e a conta de teste continua com o botão (t650)", () => {
  // O servidor é a trava; a tela não substitui a recusa.
  for (const [arq, fn] of [
    ["../data/documentos-admin.ts", "moderarDocumento"],
    ["../data/pedidos-admin.ts", "moderarPedido"],
    ["../parceiros/admin-actions.ts", "aprovarSolicitacao"],
    ["../data/fotos-perfil-actions.ts", "aprovarFotoPerfil"],
  ] as const) {
    const src = ler(arq);
    const corpo = src.slice(src.search(new RegExp(`async function ${fn}\\(`)));
    assert.match(corpo.slice(0, 1500), /recusaObservador\(/, fn);
  }
  // "Marcar como conta de teste" fica visível: a prova da Pista C (t650) clica nele para ver a recusa do servidor.
  assert.doesNotMatch(ler("../../app/(dashboard)/admin/usuarios/conta-teste.tsx"), /SoLeituraQa/);
  const servidor = ler("./observador.ts");
  assert.match(servidor, /export async function soLeituraNaTela\(/);
  assert.match(servidor, /if \(!uid \|\| !\(await deps\(admin\)\.qaAdmin\(uid\)\)\) return \[\];/);
});
