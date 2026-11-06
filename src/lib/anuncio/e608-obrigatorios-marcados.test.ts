/*
  E608: nenhum campo dos Passos 1–5 dizia que era obrigatório — a obrigatoriedade só se descobria pelo "Continuar"
  esmaecido ou pelo "Falta para publicar" da listagem, longe de onde se preenche. Agora cada obrigatório da prontidão
  nos Passos 2–5 tem o asterisco (com "obrigatório para publicar" para o leitor de tela) e o passo diz o que ele quer
  dizer. O Passo 1 (tipo) não tem obrigatório na prontidão.
  Roda: node --test src/lib/anuncio/e608-obrigatorios-marcados.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");
const D = "src/app/(dashboard)/dashboard/imoveis/novo/";

test("E608: a marca é visível e acessível; a legenda diz o que ela quer dizer", () => {
  const m = ler("src/components/anuncio/marca-obrigatorio.tsx");
  assert.match(m, /aria-hidden className="ml-1 font-semibold text-red-700">\s*\*/);
  assert.match(m, /\(obrigatório para publicar\)/);
  assert.match(m, /LEGENDA_OBRIGATORIO = "Campos com \* são obrigatórios para publicar\."/);
  const pagina = ler(D + "page.tsx");
  assert.match(pagina, /step >= ETAPA\.fotos && step <= ETAPA\.comodidades && <LegendaObrigatorio \/>/);
});

test("E608: Passo 2 — as 8 fotos", () => {
  assert.match(ler(D + "etapa-fotos.tsx"), /\/ \{MIN_PHOTOS\} fotos[\s\S]{0,120}<MarcaObrigatorio \/>/);
});

test("E608: Passo 3 — rua, número, bairro e cidade (o que segura o Continuar)", () => {
  const e = ler(D + "etapa-onde-fica.tsx");
  for (const r of [/label="Rua" obrigatorio/, /label="Número" obrigatorio/, /label="Bairro" obrigatorio/, /`Cidade\$\{p\.uf \? ` \(\$\{p\.uf\}\)` : ""\}`\} obrigatorio/]) assert.match(e, r);
  assert.doesNotMatch(e, /label="Complemento"[^>]*obrigatorio/, "complemento é opcional");
});

test("E608: Passo 4 — banheiros, área e pessoas (não quartos nem vagas)", () => {
  const e = ler(D + "etapa-encontramos.tsx");
  for (const r of [/obrigatorio label="Banheiros"/, /obrigatorio label="Área"/, /obrigatorio label="Pessoas"/]) assert.match(e, r);
  assert.doesNotMatch(e, /obrigatorio label="Quartos"|obrigatorio label="Vagas"/);
});

test("E608: Passo 5 — internet, câmeras e padrão mínimo; a internet deixa de dizer '(opcional)' no anúncio novo", () => {
  const e = ler(D + "etapa-encontramos.tsx");
  assert.match(e, /mbpsObrigatorio=\{!p\.editando\}/);
  assert.match(e, /PrivacidadeCampos valor=\{p\.privacidade\} onChange=\{p\.setPrivacidade\} obrigatorio=\{!p\.editando\}/);
  const b = ler("src/components/anuncio/blocos-cadastro.tsx");
  assert.doesNotMatch(b, /Velocidade da internet informada \(opcional\)/);
  assert.match(b, /mbpsObrigatorio \? <MarcaObrigatorio \/> : <span className="text-muted"> \(opcional\)<\/span>/);
  assert.match(ler(D + "page.tsx"), /<ChecklistConforto\s+obrigatorio=\{!editingId\}/);
});
