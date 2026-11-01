/* Roda: node --test src/lib/anuncio/rotulo-descricao.test.ts — E257 (Parte 2): todos os grupos de cartões dos Passos 5
   e 6 do cadastro seguem a regra única (todos com descrição ou nenhum), a partir dos catálogos que os alimentam. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gruposMistos, modoDaDescricao } from "./rotulo-descricao.ts";
import { ESSENCIAIS_TRABALHO, OPCIONAIS_TRABALHO } from "./sugestoes-cadastro.ts";
import { TIPOS_ENTRADA, CONSIDERAR_OPCOES } from "./chegada-e-pedido.ts";
import { REGRAS_CONVIVENCIA } from "./regras-casa-form.ts";
import { AMENITY_GROUPS } from "../amenities.ts";
import { ITENS_ESTRUTURA } from "../selos-estrutura.ts";
import { ITENS_CONFORTO } from "../../config/conforto-minimo.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("a regra: todos, nenhum ou misto", () => {
  assert.equal(modoDaDescricao([{ rotulo: "a", descricao: "x" }, { rotulo: "b", descricao: "y" }]), "todos");
  assert.equal(modoDaDescricao([{ rotulo: "a" }, { rotulo: "b", descricao: "  " }]), "nenhum");
  assert.equal(modoDaDescricao([{ rotulo: "a", descricao: "x" }, { rotulo: "b" }]), "misto");
  assert.deepEqual(gruposMistos({ ok: [{ rotulo: "a" }], ruim: [{ rotulo: "a", descricao: "x" }, { rotulo: "b" }] }), ["ruim"]);
});

test("Passos 5 e 6: nenhum grupo de cartões mistura descrição", () => {
  const grupos: Record<string, { rotulo: string; descricao?: string | null }[]> = {
    // Passo 5
    "trabalho · essenciais": ESSENCIAIS_TRABALHO.map((i) => ({ rotulo: i.rotulo })),
    "trabalho · opcionais": OPCIONAIS_TRABALHO.map((i) => ({ rotulo: i.rotulo })),
    ...Object.fromEntries(AMENITY_GROUPS.map((g) => [`comodidades · ${g.category}`, g.items.map((i) => ({ rotulo: i.label }))])),
    "padrão mínimo de conforto": ITENS_CONFORTO.map((i) => ({ rotulo: i.rotulo, descricao: i.criterio })),
    "estrutura e acessibilidade": Object.values(ITENS_ESTRUTURA).map((i) => ({ rotulo: i.rotulo, descricao: i.criterio })),
    // Passo 6
    "convivência": REGRAS_CONVIVENCIA.map((r) => ({ rotulo: r.titulo, descricao: r.descricao })),
    "como se entra": TIPOS_ENTRADA.map((t) => ({ rotulo: t.rotulo })),
    "dizer antes": CONSIDERAR_OPCOES.map((o) => ({ rotulo: o.rotulo })),
  };
  assert.deepEqual(gruposMistos(grupos), []);
});

test("as telas leem a descrição do catálogo (sem descrição condicional por cartão)", () => {
  const conforto = ler("src/components/conforto/checklist-conforto.tsx");
  assert.match(conforto, /rotulo=\{i\.rotulo\} dica=\{i\.criterio\}/);
  assert.match(ler("src/components/anuncio/estrutura-acessibilidade.tsx"), /dica=\{ITENS_ESTRUTURA\[item\]\.criterio\}/);
  // Grupos só-título: os cartões não recebem dica.
  const chegada = ler("src/components/anuncio/chegada-e-pedido-campos.tsx");
  for (const bloco of chegada.match(/<CartaoEscolha[\s\S]*?\/>/g) ?? []) assert.doesNotMatch(bloco, /\bdica=/, bloco.slice(0, 80));
  const blocos = ler("src/components/anuncio/blocos-cadastro.tsx");
  const trabalho = blocos.slice(blocos.indexOf("const item = (it: { chave: string; rotulo: string }"), blocos.indexOf('data-testid="pronto-trabalhar"'));
  assert.doesNotMatch(trabalho, /\bdica=/);
  const etapa = ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-encontramos.tsx");
  const grade = etapa.slice(etapa.indexOf("function GrupoComodidades"));
  assert.doesNotMatch(grade.slice(0, grade.indexOf("</CartaoEscolha>") > 0 ? grade.indexOf("</CartaoEscolha>") : 2000), /\bdica=/);
  // Em nenhum dos dois passos a descrição depende do cartão (ex.: dica={x ? "…" : undefined}).
  for (const arq of ["src/components/conforto/checklist-conforto.tsx", "src/components/anuncio/estrutura-acessibilidade.tsx", "src/components/anuncio/privacidade-campos.tsx", "src/app/(dashboard)/dashboard/imoveis/novo/etapa-encontramos.tsx"])
    assert.doesNotMatch(ler(arq), /dica=\{[^}]*\?[^}]*:\s*undefined\}/, arq);
});

test("convivência (Passo 6, #1716): os blocos opcionais têm título e descrição", () => {
  for (const r of REGRAS_CONVIVENCIA) assert.ok(r.titulo && r.descricao.trim(), r.chave);
  assert.match(ler("src/components/anuncio/regras-casa-campos.tsx"), /titulo=\{titulo\}\s*descricao=\{descricao\}/);
});
