/*
  Cadastro 02: Fotos (mockup cadastro-imovel-02). Roda: node --test src/lib/anuncio/cadastro-02-fotos.test.ts
  - a galeria vem logo abaixo do título, na variante "cadastro": foto principal larga com o selo "Foto principal",
    miniaturas em 3 colunas e o "+ Adicionar foto" tracejado com câmera (ao lado da principal no computador);
  - a dica de luz embaixo da galeria; "Você pode reorganizar as fotos depois de enviar." sob o "Continuar";
  - a edição do anúncio segue com a galeria padrão ("Capa").
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const etapa = ler("app/(dashboard)/dashboard/imoveis/novo/etapa-fotos.tsx");
const galeria = ler("components/photo-uploader.tsx");
const pagina = ler("app/(dashboard)/dashboard/imoveis/novo/page.tsx");

test("textos do mockup, sem vocabulário proibido", () => {
  assert.match(etapa, /export const DICA_FOTOS = "Dica: use fotos com boa iluminação e ambiente organizado\.";/);
  assert.match(etapa, /export const FOTOS_REORGANIZAR = "Você pode reorganizar as fotos depois de enviar\.";/);
  assert.match(galeria, /Foto principal/);
  assert.match(galeria, /"\+ Adicionar foto"/);
  for (const t of [etapa, galeria]) assert.doesNotMatch(t, /h[oó]spede|reserva|temporada|check-in/i);
});

test("ordem do passo: galeria, dica, contagem e só depois o resto (vídeo antes da IA)", () => {
  const i = (s: string) => {
    const n = etapa.indexOf(s);
    assert.ok(n >= 0, s);
    return n;
  };
  assert.ok(i('variante="cadastro"') < i('data-testid="fotos-dica"'));
  assert.ok(i('data-testid="fotos-dica"') < i('data-testid="fotos-contagem"'));
  assert.ok(i('data-testid="fotos-contagem"') < i('data-testid="porta-fotografo"'));
  assert.ok(i('data-testid="porta-fotografo"') < i('data-testid="bloco-video"'));
  assert.ok(i('data-testid="bloco-video"') < i('data-testid="ia-fotos"'));
  // Os ambientes sugeridos ficam dentro de "Ver dicas de foto".
  assert.ok(i("Ver dicas de foto") < i('data-testid="fotos-ambientes"'));
});

test("galeria do cadastro: principal larga, 3 colunas e o adicionar ao lado da principal no computador", () => {
  assert.match(galeria, /cad \? "grid-cols-3 lg:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"/);
  assert.match(galeria, /i === 0 && \(cad \? "col-span-3" : "col-span-2"\)/);
  assert.match(galeria, /"aspect-\[4\/3\] lg:col-start-4 lg:row-start-1 lg:self-center"/);
  // Sem foto, o adicionar ocupa a largura toda.
  assert.match(galeria, /photos\.length === 0 \? "col-span-3 min-h-48 lg:col-span-4"/);
  assert.match(galeria, /variante = "padrao"/);
});

test("a frase de reorganizar aparece só no passo Fotos, logo depois do Continuar", () => {
  const cont = pagina.indexOf('data-testid="cadastro-continuar"');
  const frase = pagina.indexOf("{step === ETAPA.fotos && (", cont);
  assert.ok(cont > 0 && frase > cont);
  assert.ok(frase < pagina.indexOf('data-testid="cadastro-voltar"', cont));
});

test("a edição do anúncio não muda (galeria padrão)", () => {
  const editar = ler("app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx");
  assert.doesNotMatch(editar, /variante="cadastro"/);
});
