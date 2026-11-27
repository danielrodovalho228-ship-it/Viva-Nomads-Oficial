/*
  E653 (família E497/E456) — "casca logada instável no meio da sessão". Causas no código (provadas aqui):
   F1  Abrir a ÁREA DO PARCEIRO gravava profiles.papel_ativo = "parceiro" (usarPapel "area" só poupava morador/proprietário, E548).
       O papel guardado mudava sem clique: nas páginas comuns o topo virava "Áreas do parceiro" e o Início apontava para
       /dashboard/parceiro, enquanto as páginas de dono se desenhavam por URL como proprietário (o topo alternava), e o menu
       Conta passava a oferecer "Modo proprietário" sem troca da pessoa. Regra única agora: abrir uma página de área NUNCA
       grava o papel (gravacaoPorArea). A troca é sempre explícita (selo ou Conta).
   F2  O modo inicial do servidor atrasado/falho virava `null` — o mesmo valor de "conta nova" — e o ModeInitializer não
       corrigia nada: sob lentidão (lote de QA) o papel salvo era abandonado em silêncio e valia o padrão do navegador
       (papel dos metadados, "tenant" na falta) → o Início do dono perdia as seções e NÃO voltava. Agora `indisponivel` é
       distinto de `null`: resolveInitialMode LANÇA no erro de leitura e o ModeInitializer relê o modo com tentativas.
  Roda: node --test src/lib/papel/e653-papel-estavel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estadoDoPapelGravado, gravacaoPorArea, papelAtivo, papelDaRota } from "./papel-ativo.ts";
import { aplicarReleitura, decidirModoInicial, ESPERAS_RELEITURA_MS, precisaReler } from "../modo-pendente.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("F1: abrir uma página de área nunca grava o papel (parceiro, morador, proprietário)", () => {
  for (const papel of ["parceiro", "morador", "proprietario"] as const) {
    assert.equal(gravacaoPorArea(papel, false), "nada", `${papel} fora do 1º acesso`);
  }
  assert.equal(gravacaoPorArea("parceiro", true), "nada", "parceiro nem no 1º acesso");
  assert.equal(gravacaoPorArea("proprietario", true), "so_modo", "1º acesso: só o modo (E283)");
  assert.equal(gravacaoPorArea("morador", true), "so_modo");
});

test("F1: dono com parceria visita a área do parceiro e volta — o papel guardado e o Início seguem os do dono", () => {
  const gravado = "proprietario"; // profiles.papel_ativo antes da visita
  // a visita à área do parceiro: não grava (nada muda no perfil)
  assert.equal(gravacaoPorArea(papelDaRota("/dashboard/parceiro/servicos", true)!, false), "nada");
  const { modo, parceiro } = estadoDoPapelGravado(gravado, "owner");
  assert.deepEqual({ modo, parceiro }, { modo: "owner", parceiro: false });
  const base = { admin: false, modo, parceiroEscolhido: parceiro, parceiroAprovado: true } as const;
  // na área do parceiro a página se desenha como parceiro (pela URL)…
  assert.equal(papelAtivo({ ...base, pathname: "/dashboard/parceiro" }), "parceiro");
  // …e de volta às páginas comuns e às do dono o papel é o do dono, sem alternar
  for (const p of ["/dashboard", "/dashboard/mensagens", "/dashboard/imoveis", "/dashboard/ganhos", "/dashboard/conta"]) {
    assert.equal(papelAtivo({ ...base, pathname: p }), "proprietario", p);
  }
});

test("F1: a casca não troca nem grava o papel ao abrir a área do parceiro", () => {
  const s = ler("src/components/papel/sincronizar-papel.tsx");
  assert.doesNotMatch(s, /setPapel\(/, "nada de setPapel na visita");
  assert.match(s, /gravacaoPorArea\(/);
  const a = ler("src/lib/data/papel-actions.ts");
  assert.match(a, /gravacaoPorArea\(papel, contaNoPrimeiroAcesso\(/, "o servidor decide pela mesma regra");
  // a troca explícita segue gravando (sem origem "area")
  assert.match(a, /const base = modo \? \{ papel_ativo: papel, preferred_mode: modo \} : \{ papel_ativo: papel \};/); // E668: a troca explícita grava papel e modo (e carimba a escolha)
});

test("F2: 'indisponível' é diferente de 'conta nova' — só o indisponível relê o modo", () => {
  assert.equal(precisaReler(null, true), true, "servidor atrasou/falhou");
  assert.equal(precisaReler(null, false), false, "conta nova: a pergunta do 1º acesso decide");
  assert.equal(precisaReler("owner", false), false);
  assert.equal(precisaReler("owner", true), false, "já veio o modo");
  assert.deepEqual(decidirModoInicial(null, null), { modo: null, regravar: false });
});

test("F2: a releitura só aplica o modo se a pessoa não trocou nem tem troca pendente no meio", () => {
  assert.equal(aplicarReleitura("owner", "tenant", "tenant", null), "owner", "nada no meio: vale o servidor");
  assert.equal(aplicarReleitura("owner", "tenant", "owner", null), null, "a pessoa trocou durante a espera");
  assert.equal(aplicarReleitura("owner", "tenant", "tenant", { modo: "tenant", em: Date.now() }), null, "troca pendente vence");
  assert.equal(aplicarReleitura(null, "tenant", "tenant", null), null, "sem modo lido não aplica nada");
  assert.ok(ESPERAS_RELEITURA_MS.length >= 3 && ESPERAS_RELEITURA_MS.every((n, i, a) => i === 0 || n > a[i - 1]), "esperas crescentes");
});

test("F2: o servidor lança em vez de virar 'conta nova', a casca marca indisponivel e o ModeInitializer relê", () => {
  const m = ler("src/lib/data/mode-actions.ts");
  const corpo = m.slice(m.indexOf("export async function resolveInitialMode"));
  assert.match(corpo, /const \{ data: profile, error: erroPerfil \}/);
  assert.match(corpo, /if \(erroPerfil\) throw new Error\("Não foi possível ler o modo agora\."\)/);
  assert.match(corpo, /const \{ count, error: erroImoveis \}/);
  assert.match(corpo, /if \(erroImoveis\) throw new Error/);
  const l = ler("src/app/(dashboard)/layout.tsx");
  assert.match(l, /indisponivel: true/);
  assert.match(l, /<ModeInitializer initialMode=\{[^}]*\} indisponivel=\{[^}]*\} \/>/);
  const i = ler("src/components/layout/mode-initializer.tsx");
  assert.match(i, /precisaReler\(/);
  assert.match(i, /resolveInitialMode\(\)/);
  assert.match(i, /aplicarReleitura\(/);
  assert.match(i, /ESPERAS_RELEITURA_MS/);
});

test("F3: contadores do menu/sino — a falha de leitura tenta de novo logo, em vez de ficar 'vazio' até o próximo minuto", async () => {
  const { ESPERAS_CONTADORES_MS, esperaRetentativaContadores } = await import("../painel/retentativa-contadores.ts");
  assert.deepEqual([...ESPERAS_CONTADORES_MS], [2_000, 5_000, 12_000]);
  assert.equal(esperaRetentativaContadores(0), 2_000);
  assert.equal(esperaRetentativaContadores(2), 12_000);
  assert.equal(esperaRetentativaContadores(3), null, "depois das tentativas, vale o relógio normal de 1 min");
  const s = ler("src/components/layout/dashboard-shell.tsx");
  assert.match(s, /esperaRetentativaContadores\(/);
  assert.match(s, /AbortError/, "o abort da limpeza do efeito não conta como falha");
  assert.match(s, /clearTimeout\(/, "a espera é cancelada na limpeza do efeito");
});
