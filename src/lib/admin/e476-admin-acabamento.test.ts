/*
  E476 (AD7, parte Pista B) — acabamento e terminologia do admin:
   (i) Fotos de perfil: a fila mostra a imagem ASSINADA do arquivo enviado (sem silhueta de substituição; sem arquivo,
       "Sem arquivo"). A silhueta vista no reteste é o próprio arquivo enviado pela conta de teste — guarda abaixo.
   (ii) Marketing: o campo nativo <input type="month"> escrevia o mês no idioma do navegador ("November 2026"). Agora é
       uma lista em português ("novembro de 2026"), com o mesmo valor gravado (AAAA-MM).
   (iii) Anúncios: o cabeçalho somava os anúncios de DEMONSTRAÇÃO como "aparecem para o público", enquanto os de teste
       diziam "Aparece para o público: não". Agora o cabeçalho separa por tipo (reais para o público, demonstração como
       exemplo, teste não aparece) e a linha da demonstração diz "como exemplo".
  Roda: node --test src/lib/admin/e476-admin-acabamento.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { opcoesDeMes, rotuloDoMes, validarGasto } from "../marketing.ts";
import { resumoPublicoDaLista, rotuloPublicoDaLinha } from "./indicadores.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("(ii) o mês em português, sem depender do idioma do navegador", () => {
  assert.equal(rotuloDoMes("2026-11"), "novembro de 2026");
  assert.equal(rotuloDoMes("2024-01"), "janeiro de 2024");
  assert.equal(rotuloDoMes("2025-03"), "março de 2025");
});

test("(ii) a lista vai do mês atual até jan/2024 (o período aceito), e todo valor passa na validação", () => {
  const o = opcoesDeMes("2026-11");
  assert.deepEqual(o[0], { valor: "2026-11", rotulo: "novembro de 2026" });
  assert.deepEqual(o.at(-1), { valor: "2024-01", rotulo: "janeiro de 2024" });
  assert.equal(o.length, 35);
  for (const { valor } of o) assert.equal(validarGasto({ mes: valor, canal: "google", valor: "10", observacao: "" }).ok, true, valor);
});

test("(ii) a tela usa a lista em português (sem o campo nativo de mês)", () => {
  const s = ler("app/(dashboard)/admin/marketing/admin-marketing-client.tsx");
  assert.doesNotMatch(s, /type="month"/);
  assert.match(s, /opcoesDeMes\(mesAtual\(\)\)\.map/);
});

test("(iii) cabeçalho: cada tipo com a sua palavra (demonstração não é 'público')", () => {
  const l = [
    { tipo: "real" as const, publico: true },
    { tipo: "real" as const, publico: false },
    { tipo: "demonstracao" as const, publico: true },
    { tipo: "demonstracao" as const, publico: true },
    { tipo: "teste" as const, publico: false },
  ];
  assert.equal(resumoPublicoDaLista(l), "1 real aparece para o público · 2 de demonstração aparecem como exemplo · 1 de teste não aparece");
  assert.equal(resumoPublicoDaLista([{ tipo: "teste", publico: false }]), "1 de teste não aparece");
  assert.equal(resumoPublicoDaLista([{ tipo: "real", publico: false }]), "nenhum aparece para o público");
  assert.equal(resumoPublicoDaLista([{ tipo: "demonstracao", publico: false }]), "nenhum aparece para o público");
});

test("(iii) linha: real sim/não, teste não, demonstração 'como exemplo' (ou não, com as demonstrações escondidas)", () => {
  assert.equal(rotuloPublicoDaLinha("real", true), "sim");
  assert.equal(rotuloPublicoDaLinha("real", false), "não");
  assert.equal(rotuloPublicoDaLinha("teste", false), "não");
  assert.equal(rotuloPublicoDaLinha("demonstracao", true), "como exemplo");
  assert.equal(rotuloPublicoDaLinha("demonstracao", false), "não");
  const p = ler("app/(dashboard)/admin/imoveis/page.tsx");
  assert.match(p, /data-testid="lista-publico">\{resumoPublicoDaLista\(lista\)\}/);
  assert.match(p, /<strong data-testid="imovel-publico">\{rotuloPublicoDaLinha\(i\.tipo, i\.publico\)\}<\/strong>/);
});

test("(i) a fila de fotos mostra o arquivo enviado (URL assinada), nunca uma silhueta no lugar", () => {
  const f = ler("app/(dashboard)/admin/fotos-perfil/fila-fotos-cliente.tsx");
  assert.match(f, /<img src=\{f\.url\}/);
  assert.match(f, /Sem arquivo/);
  assert.doesNotMatch(f, /UserRound|silhueta|placeholder/i);
});
