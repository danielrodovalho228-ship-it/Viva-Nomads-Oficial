/*
  Prompt 41 — guardas de código (o E2E t258 confere o mesmo na tela, a 390 e 1280 px):
   - cogumelo: só ações cuja função existe, nunca cancelar/avaliar/pagar, só no detalhe da estadia;
   - página do imóvel: a ordem, o "Solicitar" (a candidatura de sempre), a visita em texto terciário, o total pela
     duração e "a Viva não segura dinheiro" em todo rótulo de valor;
   - botão: data-cta="primary" só no primário.
  Roda: node --test src/lib/estadia/prompt-41.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ACOES_QUE_ESPERAM, PROIBIDAS_NO_COGUMELO, acoesDaEstadia } from "./acoes-estadia.ts";

const SRC = new URL("../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(SRC, p), "utf8");
const semComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

function arquivos(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(join(SRC, dir))) {
    const rel = join(dir, f);
    if (statSync(join(SRC, rel)).isDirectory()) arquivos(rel, out);
    else if (/\.tsx$/.test(f)) out.push(rel);
  }
  return out;
}

test("cogumelo: morador com estadia ativa e instruções → falar, contrato, instruções e manutenção", () => {
  const a = acoesDaEstadia({ papel: "inquilino", status: "ativo", temInstrucoes: true });
  assert.deepEqual(
    a.map((x) => x.rotulo),
    ["Falar com o proprietário", "Ver o contrato", "Ver instruções de chegada", "Pedir manutenção"],
  );
  assert.deepEqual(a.map((x) => x.href), ["/dashboard/mensagens", "#contrato", "#checkin-painel", "/dashboard/solicitacoes"]);
});

test("cogumelo: proprietário fala com o morador e vê o contrato; manutenção é pedido do morador", () => {
  const a = acoesDaEstadia({ papel: "proprietario", status: "ativo", temInstrucoes: false });
  assert.deepEqual(a.map((x) => x.rotulo), ["Falar com o morador", "Ver o contrato"]);
  // Estadia encerrada: sem manutenção nem instruções.
  assert.deepEqual(
    acoesDaEstadia({ papel: "inquilino", status: "concluido", temInstrucoes: false }).map((x) => x.chave),
    ["falar", "contrato"],
  );
});

test("cogumelo: nunca cancelar, avaliar, pagar ou link genérico; o que espera fica listado", () => {
  for (const papel of ["inquilino", "proprietario"] as const) {
    for (const a of acoesDaEstadia({ papel, status: "ativo", temInstrucoes: true })) {
      assert.doesNotMatch(a.rotulo, PROIBIDAS_NO_COGUMELO, a.rotulo);
      assert.ok(a.href.startsWith("#") || a.href.startsWith("/dashboard/"), a.href);
    }
  }
  assert.deepEqual(
    ACOES_QUE_ESPERAM.map((x) => x.rotulo),
    ["Pedir limpeza", "Avisar um problema", "Propor alteração de datas"],
  );
});

test("cogumelo: as âncoras e a rota de cada ação existem; ele só aparece no detalhe da estadia", () => {
  const detalhe = ler("components/contrato/contrato-detalhe.tsx");
  assert.match(detalhe, /<Panel id="contrato"/);
  assert.match(detalhe, /<Panel id="checkin-painel"/);
  assert.match(detalhe, /<AcoesEstadia acoes=\{acoesDaEstadia\(\{ papel: c\.papel, status: c\.status, temInstrucoes: !!checkin \}\)\} \/>/);
  assert.ok(existsSync(join(SRC, "app/(dashboard)/dashboard/solicitacoes/page.tsx")));
  assert.ok(existsSync(join(SRC, "app/(dashboard)/dashboard/mensagens/page.tsx")));
  const usos = [...arquivos("app"), ...arquivos("components")].filter((f) => /<AcoesEstadia\b/.test(ler(f)));
  assert.deepEqual(usos, ["components/contrato/contrato-detalhe.tsx"]);
  // Os dois caminhos da estadia (morador e proprietário) usam o mesmo detalhe.
  assert.match(ler("app/(dashboard)/dashboard/locacoes/[id]/page.tsx"), /<ContratoDetalhe /);
  assert.match(ler("app/(dashboard)/dashboard/contratos/[id]/page.tsx"), /<ContratoDetalhe /);
});

test("cogumelo: flutuante com a sombra única, folha 'Ações desta estadia' e o Fale com a Viva sobe acima dele", () => {
  const c = ler("components/estadia/acoes-estadia.tsx");
  assert.match(c, /buttonClasses\(\{ variant: "flutuante"/);
  assert.match(c, /title="Ações desta estadia"/);
  const css = ler("app/globals.css");
  assert.match(css, /body:has\(\[data-testid="cogumelo"\]\) \{\s*--ajuda-bottom: calc\(var\(--cogumelo-bottom\) \+ 4rem\);\s*--viva-piso:/);
});

test("página do imóvel: ordem do Prompt 41 (galeria → título → síntese → anfitrião → comodidades → regras → mapa → avaliações)", () => {
  const d = semComentarios(ler("app/(public)/imoveis/[id]/property-detail.tsx"));
  const marcos = ["<PropertyGallery", "<h1", 'data-testid="imovel-sintese"', "<FaixaProprietario", "<AmenitiesGrid", "<StayRules", 'id="localizacao"', 'id="avaliacoes"', 'id="proprietario"'];
  const pos = marcos.map((m) => d.indexOf(m));
  assert.ok(pos.every((p, i) => p > 0 && (i === 0 || p > pos[i - 1])), `ordem ${marcos.map((m, i) => `${m}@${pos[i]}`).join(", ")}`);
  // "Ideal para" mora aqui, logo depois da síntese (saiu do cartão no #953).
  assert.ok(d.indexOf("<IdealPara") > d.indexOf('data-testid="imovel-sintese"'));
  // Sem cômodo marcado nas fotos (o dado ainda não existe): o bloco "Onde você vai dormir" não aparece; "Tempo até" não entra.
  assert.doesNotMatch(d, /Onde você vai dormir|Tempo até|em breve/i);
  // Coração e compartilhar como ícones; galeria em tela cheia no celular com "1/N"; mosaico de 5 com "Ver todas as fotos".
  assert.match(d, /<FavoriteButton propertyId=\{property\.id\} \/>/);
  assert.match(d, /<ShareButton icone /);
  const g = ler("components/property-gallery.tsx");
  assert.match(g, /data-testid="galeria-indicador"/);
  assert.match(g, /-mx-5 -mt-8 sm:-mx-8 md:hidden/);
  assert.match(g, /<Images className="h-4 w-4" \/> Ver todas as fotos/);
});

test("página do imóvel: UM primário 'Solicitar' (a candidatura de sempre); a visita é texto terciário", () => {
  const d = semComentarios(ler("app/(public)/imoveis/[id]/property-detail.tsx"));
  const acoes = d.slice(d.indexOf("const actions = candidatouSe"), d.indexOf("const composer ="));
  assert.equal((acoes.match(/variant="primary"/g) ?? []).length, 1);
  assert.match(acoes, /"Solicitar"/);
  assert.match(acoes, /onClick=\{abrirSolicitacao\}/); // o mesmo fluxo da candidatura
  assert.match(acoes, /variante="tertiary"/);
  // O passo final do fluxo segue sendo "Enviar candidatura".
  assert.match(d, /"Enviar candidatura"/);
  const barra = ler("components/property/barra-fixa-celular.tsx");
  assert.match(barra, /\{pending \? "Enviando\.\.\." : "Solicitar"\}/);
  assert.match(barra, /data-cta=\{marcaCta\("primary"\)\}/);
  assert.match(barra, /buttonClasses\(\{ variant: "tertiary", size: "sm" \}\)\}>\s*Agendar visita/);
  assert.match(barra, /shadow-flutuante/);
});

test("valor: 'R$ X/mês · R$ Y em N meses' pela regra do cartão e 'a Viva não segura dinheiro' em todo rótulo de valor", () => {
  const d = ler("app/(public)/imoveis/[id]/property-detail.tsx");
  assert.match(d, /const meses = mesesDoCartao\(mesesBusca \|\| undefined, property\.minPeriodDays\);/);
  assert.match(ler("lib/barra-fixa-imovel.ts"), /rotuloPrecoCartao\(total, p\.meses \?\? 1\)/);
  assert.match(ler("components/property/price-card.tsx"), /const preco = rotuloPrecoCartao\(mes\.total, meses\);/);
  for (const f of ["components/property/barra-fixa-celular.tsx", "components/property/price-card.tsx"]) assert.match(ler(f), /FRASE_NAO_SEGURA_DINHEIRO/, f);
});

test("botão: data-cta=\"primary\" só no primário (primary e os nomes antigos accent/gold)", () => {
  const b = ler("components/ui/button.tsx");
  assert.match(b, /return variant === "primary" \|\| variant === "accent" \|\| variant === "gold" \? "primary" : "";/);
  assert.match(b, /data-cta=\{marcaCta\(variant\)\}/);
});
