import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROTULOS_NUMEROS, RODAPE_CONTAGENS, baseDoFunil, contarRealETeste, primeirosSemDuplicata, razaoOuTraco, textoRealTeste } from "./contagens.ts";

const ler = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

test("contarRealETeste separa pela regra única e 'N reais · M de teste'", () => {
  const teste = new Set(["t1", "t2"]);
  const c = contarRealETeste([{ u: "a" }, { u: "t1" }, { u: "b" }, { u: "t2" }, { u: "c" }], (l) => teste.has(l.u));
  assert.deepEqual(c, { reais: 3, teste: 2 });
  assert.equal(textoRealTeste(c), "3 reais · 2 de teste");
  assert.equal(textoRealTeste({ reais: 1, teste: 0 }), "1 real");
  assert.equal(textoRealTeste({ reais: 0, teste: 3 }), "0 reais · 3 de teste");
});

test("sem denominador é '—' (E128: 'chamados por 100 contratos' com 0 contratos; funil '8 de 0')", () => {
  assert.equal(razaoOuTraco(5, 0), "—");
  assert.equal(razaoOuTraco(1, 4, (x) => `${x * 100}%`), "25%");
  assert.equal(baseDoFunil("percentual", { de: 8, total: 0 }), "Base: —.");
  assert.equal(baseDoFunil("percentual", { de: 3, total: 10 }), "3 de 10.");
  assert.equal(baseDoFunil("horas", { de: 0, total: 4 }), "4 tempo(s).");
});

test("'Precisa da sua atenção': os 5 primeiros, sem duplicata", () => {
  const itens = ["a", "b", "a", "c", "b", "d", "e", "f", "g"].map((k, i) => ({ k, i }));
  const r = primeirosSemDuplicata(itens, (x) => x.k);
  assert.deepEqual(r.map((x) => x.k), ["a", "b", "c", "d", "e"]);
  assert.equal(new Set(r.map((x) => x.k)).size, r.length);
  const pagina = ler("app/(dashboard)/admin/page.tsx");
  assert.match(pagina, /primeirosSemDuplicata\(decisoes\.linhas, \(l\) => l\.href\)/);
});

test("cada número da inicial = o número da página de destino (a MESMA função)", () => {
  const dados = ler("lib/data/admin-contagens.ts");
  const fonte = ler("components/admin/numero-da-fonte.tsx");
  const funcao = { estadias: "contarEstadiasAtivas", anuncios: "contarAnunciosPublicados", pedidos: "contarPedidosNoAr", chamados: "contarChamadosAbertos" } as const;
  const destino = { estadias: "contratos", anuncios: "imoveis", pedidos: "pedidos", chamados: "atendimento" } as const;
  for (const k of Object.keys(ROTULOS_NUMEROS) as (keyof typeof funcao)[]) {
    assert.match(dados, new RegExp(`${k}[\\s\\S]*?${funcao[k]}\\(admin, teste\\)`), `inicial usa ${funcao[k]}`);
    assert.match(dados, new RegExp(`const \\[estadias, anuncios, pedidos, chamados\\] = await Promise\\.all\\(\\[[\\s\\S]*${funcao[k]}`));
    assert.match(fonte, new RegExp(`${k}: ${funcao[k]},`), `a página de destino usa ${funcao[k]}`);
    assert.match(ler(`app/(dashboard)/admin/${destino[k]}/page.tsx`), new RegExp(`<NumeroDaFonte chave="${k}" />`), `${destino[k]} mostra o número`);
    assert.ok(ROTULOS_NUMEROS[k].href.startsWith(`/admin/${destino[k]}`), `o número leva a ${destino[k]}`);
  }
  assert.match(fonte, /usuarios: contarUsuarios,/);
  // A regra das contas de teste é uma só: idsContasTeste (profiles.is_teste).
  assert.match(dados, /import \{ idsContasTeste \} from "@\/lib\/data\/admin-indicadores"/);
  assert.match(dados, /export async function contarUsuarios[\s\S]*?is_teste/);
  // L-69: o número do topo de /admin/usuarios e a lista padrão usam a MESMA regra (PAPEIS_USUARIOS, sem anonimizados).
  const contar = dados.slice(dados.indexOf("export async function contarUsuarios"), dados.indexOf("export async function contarEmailsTeste"));
  assert.match(contar, /\.is\("anonymized_at", null\)\.in\("role", \[\.\.\.PAPEIS_USUARIOS\]\)/, "contarUsuarios usa a regra da lista");
  const lista = ler("app/(dashboard)/admin/usuarios/page.tsx");
  assert.match(lista, /\.is\("anonymized_at", null\)\.in\("role", f\.papel \? \[f\.papel\] : \[\.\.\.PAPEIS_USUARIOS\]\)/, "a lista padrão usa a mesma regra");
  assert.ok(!/\["owner", "tenant"\]/.test(lista), "a lista não repete os papéis à mão");
});

test("a inicial: rodapé, saúde e no máximo ~6 leituras em paralelo", () => {
  const pagina = ler("app/(dashboard)/admin/page.tsx");
  assert.ok(pagina.includes("{RODAPE_CONTAGENS}"));
  assert.equal(RODAPE_CONTAGENS, "Contas de teste não entram nestas contagens.");
  assert.match(pagina, /Tudo funcionando/);
  // E176 (D3): a saúde não repete o alerta do backup (ele mora em "Precisa da sua atenção").
  assert.match(pagina, /Há alertas em “Precisa da sua atenção”\./);
  const bloco = pagina.slice(pagina.indexOf("await Promise.all(["), pagina.indexOf("]);", pagina.indexOf("await Promise.all([")));
  assert.equal(bloco.split("\n").filter((l) => /^\s+\S.*,$/.test(l)).length, 4, "4 leituras na inicial (a 4ª é a contagem de espaço de trabalho, ordem 286312f8)");
  assert.match(pagina, /l\.chave === "backup"/, "a saúde usa a mesma leitura das filas");
  assert.match(pagina, /numerosDaInicial\(admin, teste\)/, "as contas de teste são lidas uma vez só");
});

test("E334: contas de teste por uma regra só — as de Usuários (proprietário/inquilino não anonimizado) e o resto à parte", async () => {
  const { resumoContasTeste, textoContasTeste } = await import("./contagens.ts");
  // O caso de produção: 4 proprietários + 9 inquilinos + 1 admin, todos is_teste.
  const contas = [
    ...Array.from({ length: 4 }, () => ({ role: "owner" })),
    ...Array.from({ length: 9 }, () => ({ role: "tenant" })),
    { role: "admin" },
  ];
  const r = resumoContasTeste(contas);
  assert.deepEqual(r, { total: 14, usuarios: 13, outras: 1 });
  assert.equal(textoContasTeste(r), "14 · 13 proprietários e inquilinos (os de Usuários) · 1 da equipe ou anonimizada");
  assert.deepEqual(resumoContasTeste([{ role: "owner", anonymized_at: "2026-10-01" }]), { total: 1, usuarios: 0, outras: 1 });
  assert.equal(textoContasTeste(resumoContasTeste([{ role: "tenant" }])), "1");
});

test("E334: Retenção e caixa de e-mails contam os guardados pela mesma função, agora", async () => {
  const { readFileSync } = await import("node:fs");
  const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  assert.match(ler("lib/data/admin-contagens.ts"), /return contarGuardados\(admin, "emails_teste"\);/);
  assert.match(ler("lib/minimizacao/servidor.ts"), /contarGuardados\(admin, item\.origem\.slice\(7\)\)/);
  const ret = ler("app/(dashboard)/admin/retencao/page.tsx");
  assert.match(ret, /contarGuardados\(admin, origem\.slice\(7\)\)/);
  assert.match(ret, /Guardados agora/);
  const testes = ler("app/(dashboard)/admin/dados-de-teste/page.tsx");
  assert.match(testes, /Contas de teste · \$\{textoContasTeste\(resumoTeste\)\}/);
  // A contagem de Usuários segue a mesma regra (proprietário/inquilino não anonimizado).
  assert.match(ler("lib/data/admin-contagens.ts"), /\.is\("anonymized_at", null\)\.in\("role", \[\.\.\.PAPEIS_USUARIOS\]\)/);
});

test("E334 (resíduo): uma fonte para a regra e para o total de e-mails", async () => {
  const { readFileSync } = await import("node:fs");
  const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  // A regra das contas de Usuários vem de PAPEIS_USUARIOS (a mesma de contarUsuarios), não de uma cópia à mão.
  const c = ler("lib/admin/contagens.ts");
  assert.match(c, /import \{ PAPEIS_USUARIOS \} from "\.\/usuarios-lista\.ts"/);
  assert.doesNotMatch(c, /c\.role === "owner" \|\| c\.role === "tenant"/);
  // Falha na contagem de e-mails: "—" na caixa (como na Retenção), nunca 0 nem o tamanho da lista.
  const d = ler("lib/data/admin-contagens.ts");
  assert.match(d, /export async function contarEmailsTeste\(admin: Admin\): Promise<number \| null> \{\n  return contarGuardados\(admin, "emails_teste"\);/);
  const caixa = ler("components/admin/emails-teste-lista.tsx");
  assert.match(caixa, /valor=\{total \?\? "—"\}/);
  assert.doesNotMatch(caixa, /total \?\? linhas\.length/);
});
