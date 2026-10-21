/*
  Ações da página da estadia (Prompt 41, adendo da estadia): o cogumelo, o primário "Mensagem" e o "Encerrar" no fim.
  O E2E t259 confere o mesmo na tela (morador e proprietário, antes e depois da liberação das instruções, 390 e 1280).
  Roda: node --test src/lib/estadia/acoes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PROIBIDAS_NO_COGUMELO, acoesDaEstadia, encerrarDaEstadia, hrefPedirServico, mensagemDaEstadia, type ContratoDaEstadia } from "./acoes.ts";

const SRC = new URL("../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(SRC, p), "utf8");
const semComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const ID = "11111111-2222-4333-8444-555555555555";
const IMOVEL = "66666666-7777-4888-8999-aaaaaaaaaaaa";
const base: ContratoDaEstadia = { id: ID, fase: "antes", conversaId: "conv-1", imovelId: IMOVEL, cidade: "Uberlândia", instrucoesLiberadas: false };
const est = `/dashboard/estadia/${ID}`;
const limpeza = `/parceiros/buscar?categoria=limpeza&cidade=Uberl%C3%A2ndia&imovel=${IMOVEL}`;
const manutencao = `/parceiros/buscar?categoria=manutencao&cidade=Uberl%C3%A2ndia&imovel=${IMOVEL}`;
const pares = (a: { rotulo: string; href: string }[]) => a.map((x) => [x.rotulo, x.href]);

test("morador antes da liberação: sem 'Ver instruções de chegada' e sem calendário", () => {
  assert.deepEqual(pares(acoesDaEstadia("inquilino", base)), [
    ["Falar com o proprietário", "/dashboard/mensagens?conversa=conv-1"],
    ["Ver o contrato", `/dashboard/locacoes/${ID}`],
    ["Propor alteração de datas", `${est}/alteracao`],
    ["Pedir limpeza", limpeza],
    ["Pedir manutenção", manutencao],
  ]);
});

test("morador depois da liberação: 'Ver instruções de chegada' entra, antes dos pedidos de serviço", () => {
  assert.deepEqual(
    acoesDaEstadia("inquilino", { ...base, fase: "durante", instrucoesLiberadas: true }).map((x) => x.chave),
    ["falar", "contrato", "alteracao", "instrucoes", "limpeza", "manutencao"],
  );
  assert.equal(acoesDaEstadia("inquilino", { ...base, instrucoesLiberadas: true }).find((x) => x.chave === "instrucoes")?.href, `${est}#instrucoes`);
});

test("proprietário: fala com o morador, vê as instruções (edita nesta página) e o calendário (Agenda)", () => {
  assert.deepEqual(pares(acoesDaEstadia("proprietario", base)), [
    ["Falar com o morador", "/dashboard/mensagens?conversa=conv-1"],
    ["Ver o contrato", `/dashboard/contratos/${ID}`],
    ["Propor alteração de datas", `${est}/alteracao`],
    ["Ver instruções de chegada", `${est}#instrucoes`],
    ["Pedir limpeza", limpeza],
    ["Pedir manutenção", manutencao],
    ["Ver no calendário", "/dashboard/agenda"],
  ]);
});

test("estadia encerrada: só falar e ver o contrato; sem Encerrar no fim da página", () => {
  for (const papel of ["inquilino", "proprietario"] as const) {
    const c = { ...base, fase: "encerrada" as const, instrucoesLiberadas: true };
    assert.deepEqual(acoesDaEstadia(papel, c).map((x) => x.chave), ["falar", "contrato"], papel);
    assert.equal(encerrarDaEstadia(papel, c), null);
  }
});

test("primário único 'Mensagem' para a conversa; 'Encerrar contrato' leva à confirmação na própria página", () => {
  assert.deepEqual(mensagemDaEstadia(base), { rotulo: "Mensagem", href: "/dashboard/mensagens?conversa=conv-1" });
  for (const papel of ["inquilino", "proprietario"] as const) {
    assert.deepEqual(encerrarDaEstadia(papel, base), { rotulo: "Encerrar contrato", href: `${est}/encerrar` });
  }
});

test("cogumelo: nunca cancelar, encerrar, avaliar, pagar ou link genérico; vocabulário da Viva", () => {
  for (const papel of ["inquilino", "proprietario"] as const) {
    for (const fase of ["antes", "durante", "encerrada"] as const) {
      for (const a of acoesDaEstadia(papel, { ...base, fase, instrucoesLiberadas: true })) {
        assert.doesNotMatch(a.rotulo, PROIBIDAS_NO_COGUMELO, a.rotulo);
        assert.doesNotMatch(a.rotulo, /aluguel|vistoria|temporada|comiss/i, a.rotulo);
        assert.ok(/^\/dashboard\/(mensagens\?conversa=|contratos\/|locacoes\/|estadia\/|agenda$)|^\/parceiros\/buscar\?/.test(a.href), a.href);
      }
    }
  }
});

test("pedir serviço: a busca de parceiros na categoria; sem cidade, só a categoria e o imóvel", () => {
  assert.equal(hrefPedirServico("limpeza", { imovelId: IMOVEL, cidade: null }), `/parceiros/buscar?categoria=limpeza&imovel=${IMOVEL}`);
  // A busca leva o imóvel e a categoria até a página do parceiro, e a página passa os dois à folha "Solicitar orçamento".
  const busca = semComentarios(ler("app/(public)/parceiros/buscar/page.tsx"));
  assert.match(busca, /new URLSearchParams\(\{ imovel, \.\.\.\(categoria \? \{ categoria \} : \{\}\) \}\)/);
  assert.match(busca, /<CartaoParceiro key=\{p\.id\} p=\{p\} consulta=\{consultaDoImovel\} \/>/);
  assert.match(busca, /<input type="hidden" name="imovel" value=\{imovel\} \/>/);
  const parceiro = semComentarios(ler("app/(public)/parceiros/[slug]/page.tsx"));
  assert.match(parceiro, /imovelInicial=\{imovelDoCadastro\}\s+categoriaInicial=\{categoriaInicial\}/);
  assert.match(ler("components/parceiros/solicitar-orcamento.tsx"), /servicos\.find\(\(s\) => s\.categoria === categoriaInicial\)/);
});

test("as rotas de cada ação existem", () => {
  for (const r of [
    "app/(dashboard)/dashboard/mensagens/page.tsx",
    "app/(dashboard)/dashboard/contratos/[id]/page.tsx",
    "app/(dashboard)/dashboard/locacoes/[id]/page.tsx",
    "app/(dashboard)/dashboard/estadia/[contratoId]/alteracao/page.tsx",
    "app/(dashboard)/dashboard/estadia/[contratoId]/encerrar/page.tsx",
    "app/(dashboard)/dashboard/agenda/page.tsx",
    "app/(public)/parceiros/buscar/page.tsx",
  ]) {
    assert.ok(existsSync(join(SRC, r)), r);
  }
  assert.match(ler("app/(dashboard)/dashboard/estadia/[contratoId]/page.tsx"), /id="instrucoes"/);
  // A /encerrar confirma na própria página (nunca um diálogo do navegador).
  assert.match(ler("app/(dashboard)/dashboard/estadia/[contratoId]/encerrar/encerrar-tela.tsx"), /<ConfirmarNaPagina/);
});

function arquivos(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(join(SRC, dir))) {
    const rel = join(dir, f);
    if (statSync(join(SRC, rel)).isDirectory()) arquivos(rel, out);
    else if (/\.tsx$/.test(f)) out.push(rel);
  }
  return out;
}

test("página da estadia: sem a fileira de ações; um primário (Mensagem); Encerrar em texto vermelho no fim; o cogumelo só aqui", () => {
  const p = semComentarios(ler("app/(dashboard)/dashboard/estadia/[contratoId]/page.tsx"));
  assert.doesNotMatch(p, /estadia-acoes"|aria-label="Ações desta estadia"/);
  assert.equal((p.match(/variant="primary"/g) ?? []).length, 1);
  assert.match(p, /<ButtonLink href=\{mensagem\.href\} variant="primary" size="sm" data-testid="estadia-acao-mensagem">/);
  assert.match(p, /<ButtonLink href=\{encerrar\.href\} variant="destructive" size="sm" data-testid="estadia-acao-encerrar">/);
  // "Encerrar" é a última ação da página; depois dele só o cogumelo (flutuante).
  const fim = p.slice(p.indexOf('data-testid="estadia-fim"'));
  assert.ok(p.indexOf('data-testid="estadia-fim"') > p.indexOf('data-testid="estadia-instrucoes"'));
  assert.doesNotMatch(fim.slice(fim.indexOf("</div>")), /<ButtonLink|<Button\b|<Link\b/);
  assert.match(fim, /<AcoesEstadia acoes=\{acoesDaEstadia\(e\.papel, contrato\)\} \/>/);
  // Nenhum outro primário na estadia (responder e assinar o aditivo ficam secundários).
  assert.doesNotMatch(ler("app/(dashboard)/dashboard/estadia/[contratoId]/estadia-tela.tsx"), /variant="primary"/);
  const usos = [...arquivos("app"), ...arquivos("components")].filter((f) => /<AcoesEstadia\b/.test(ler(f)));
  assert.deepEqual(usos, ["app/(dashboard)/dashboard/estadia/[contratoId]/page.tsx"]);
  // O detalhe do contrato aponta para a estadia (um cogumelo só por estadia).
  assert.match(ler("components/contrato/contrato-detalhe.tsx"), /data-testid="contrato-abrir-estadia"/);
});

test("cogumelo: flutuante com a sombra única, folha 'Ações desta estadia' e o Fale com a Viva sobe acima dele", () => {
  const c = ler("components/estadia/acoes-estadia.tsx");
  assert.match(c, /buttonClasses\(\{ variant: "flutuante"/);
  assert.match(c, /title="Ações desta estadia"/);
  assert.match(c, /from "@\/lib\/estadia\/acoes"/);
  const css = ler("app/globals.css");
  assert.match(css, /body:has\(\[data-testid="cogumelo"\]\) \{\s*--ajuda-bottom: calc\(var\(--cogumelo-bottom\) \+ 4rem\);\s*--viva-piso:/);
});
