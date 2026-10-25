import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { criterioDoItemNoCadastro, TEXTO_ESSENCIAL_DECLARADO } from "../niveis/cadastro-passo5.ts";
import { itemNivel } from "../../config/niveis.ts";
import { contadorEssenciais, essenciaisMarcados, ESSENCIAIS_TRABALHO, OPCIONAIS_TRABALHO } from "./sugestoes-cadastro.ts";
import { buscaNaoRespondeu } from "./proximidades.ts";

/*
  Passo 5 do cadastro — levantamento do Daniel, 25/10 (E141–E146 + o subtítulo da internet do E151).
*/
const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const PAGINA = ler("app/(dashboard)/dashboard/imoveis/novo/page.tsx");
const NIVEL = ler("components/niveis/nivel-cadastro.tsx");

test("E141 — o Essencial é declarado e publica sem foto; a foto só sobe o nível, numa cobrança só", () => {
  assert.match(TEXTO_ESSENCIAL_DECLARADO, /publica sem foto/);
  assert.match(NIVEL, /data-testid="nivel-cadastro-declarado"/);
  assert.match(NIVEL, /· opcional/);
  assert.doesNotMatch(PAGINA, /AlertaFaltaFoto|deteccaoLigada/);
});

test("E142 — a detecção é o primeiro bloco do Passo 5 (visível na chegada, sem rolar)", () => {
  const passo = PAGINA.slice(PAGINA.indexOf("{step === ETAPA.comodidades && ("), PAGINA.indexOf("{step === ETAPA.regras && ("));
  assert.ok(passo.indexOf("<SugestoesDasFotos") < passo.indexOf("<EtapaEncontramos"), "detecção antes das comodidades");
  assert.ok(passo.indexOf("<SugestoesDasFotos") < passo.indexOf("<NivelNoCadastro"));
});

test("E143 — ruído e extras dentro do passo, com toggles; nenhum link para a página antiga", () => {
  assert.doesNotMatch(NIVEL, /\/dashboard\/imoveis\/\$\{propertyId\}\/nivel/);
  assert.match(NIVEL, /<BlocoOpcional\s+id="nivel-ruido"/);
  assert.match(NIVEL, /<BlocoOpcional\s+id="nivel-extras"/);
  assert.match(NIVEL, /<Ruido propertyId=\{propertyId\}/);
  assert.match(NIVEL, /<Extras propertyId=\{propertyId\}/);
  // A página do nível continua usando os mesmos componentes (sem cópia).
  assert.match(ler("app/(dashboard)/dashboard/imoveis/[id]/nivel/form-nivel.tsx"), /from "@\/components\/niveis\/ruido-extras"/);
});

test("E144 — um caminho por vez: com o QR aberto, o botão de fotografar sai", () => {
  const cam = ler("components/niveis/camera-prova.tsx");
  assert.match(cam, /\{!\(aberto && !celular && modo\) && \(\s*<Button/);
});

test("E145 — 'não respondeu' é diferente de 'não há lugares'; lista vazia guardada busca de novo", () => {
  assert.equal(buscaNaoRespondeu("sem_ponto"), true);
  assert.equal(buscaNaoRespondeu("limite"), true);
  assert.equal(buscaNaoRespondeu("erro"), true);
  assert.equal(buscaNaoRespondeu("sem_lugares"), false);
  assert.equal(buscaNaoRespondeu("osm"), false);
  assert.equal(buscaNaoRespondeu(null), false);
  assert.match(PAGINA, /if \(Array\.isArray\(d\.proxOsm\) && d\.proxOsm\.length > 0\) \{/);
  const blocos = ler("components/anuncio/blocos-cadastro.tsx");
  assert.match(blocos, /data-testid="proximidades-tentar"/);
  assert.doesNotMatch(blocos, /variant="secondary" size="sm" onClick=\{\(\) => setAdicionando\(true\)\}/, "o manual não é botão");
});

test("E146 — o contador conta só os essenciais marcados, chip a chip", () => {
  const todos = Object.fromEntries([...ESSENCIAIS_TRABALHO, ...OPCIONAIS_TRABALHO].map((i) => [i.chave, true]));
  assert.equal(essenciaisMarcados(todos), 4);
  const tres = { home_office: true, mesa_trabalho: true, cadeira_ergonomica: true, ambiente_silencioso: true, iluminacao_boa: true };
  assert.equal(contadorEssenciais(tres), "3 de 4 itens essenciais");
  assert.equal(contadorEssenciais({ internet_fibra: false, home_office: true }), "1 de 4 itens essenciais");
});

test("E151 — o subtítulo do item não repete o título (internet medida no quarto principal)", () => {
  const internet = itemNivel("internet_medida_quarto");
  assert.equal(criterioDoItemNoCadastro(internet), null);
  assert.equal(criterioDoItemNoCadastro({ rotulo: "Ar-condicionado no quarto", criterio: "Ar-condicionado no quarto", prova: "foto" }), null);
  assert.equal(criterioDoItemNoCadastro({ rotulo: "Micro-ondas", criterio: "Funcionando, na cozinha.", prova: "foto" }), "Funcionando, na cozinha.");
});
