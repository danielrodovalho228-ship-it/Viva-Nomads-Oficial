/* Roda: node --test src/components/anuncio/regras-icones.test.ts — conformidade do cadastro (Passo 6, mockup 06, 01/11):
   cada regra tem o seu ícone — os 4 sim/não (mobiliado, pets, crianças, fumar) e os blocos de convivência (silêncio,
   festas, visitas; fumo quando aparece). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("os 4 sim/não do Passo 6 têm ícone", () => {
  const e = ler("../../app/(dashboard)/dashboard/imoveis/novo/etapa-encontramos.tsx");
  assert.match(e, /label="Mobiliado e equipado"\n\s*icone=\{Sofa\}/);
  assert.match(e, /label="Aceita pets"[^>]*icone=\{PawPrint\}/);
  assert.match(e, /label="Aceita crianças"[^>]*icone=\{Baby\}/);
  assert.match(e, /label="Permite fumar"[^>]*icone=\{Cigarette\}/);
  assert.match(ler("../../app/(dashboard)/dashboard/imoveis/novo/campos.tsx"), /testid=\{testid\}\n\s*icone=\{icone\}/);
});

test("cada regra de convivência tem ícone e o bloco o desenha", () => {
  const r = ler("./regras-casa-campos.tsx");
  assert.match(r, /silencio: Moon,\n\s*fumo: Cigarette,\n\s*festas: PartyPopper,\n\s*visitas: UsersRound,/);
  assert.match(r, /icone=\{ICONE_REGRA\[chave\]\}/);
  assert.match(ler("./bloco-opcional.tsx"), /\{Icone && <Icone [^>]*data-testid=\{`bloco-\$\{id\}-icone`\}/);
});
