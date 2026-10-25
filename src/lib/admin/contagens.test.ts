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
});

test("a inicial: rodapé, saúde e no máximo ~6 leituras em paralelo", () => {
  const pagina = ler("app/(dashboard)/admin/page.tsx");
  assert.ok(pagina.includes("{RODAPE_CONTAGENS}"));
  assert.equal(RODAPE_CONTAGENS, "Contas de teste não entram nestas contagens.");
  assert.match(pagina, /Tudo funcionando/);
  assert.match(pagina, /alertas === 1 \? "alerta" : "alertas"\} → Sistema/);
  const bloco = pagina.slice(pagina.indexOf("await Promise.all(["), pagina.indexOf("]);", pagina.indexOf("await Promise.all([")));
  assert.equal(bloco.split("\n").filter((l) => /^\s+\S.*,$/.test(l)).length, 4, "4 leituras na inicial");
  assert.match(pagina, /numerosDaInicial\(admin, teste\)/, "as contas de teste são lidas uma vez só");
});
