/*
  E590 (relato do Daniel, celular, 05/11; ordem da vigia: correção de CÓDIGO): o painel "Nível" mostrava só um aviso
  quando a busca não tinha anúncio com nível (o caso de Uberlândia para quem não é conta de teste) — "as opções não
  aparecem". Agora o painel abre SEMPRE com Essencial / Conforto / Premium e o contador de cada um, em qualquer largura;
  a opção com imóvel aplica (URL ?nivel= e pílula), a com zero fica desabilitada (como Tipo e Preço). Sem nenhum nível
  na busca, uma nota curta embaixo das opções explica o zero (antes ela substituía o grupo — NIVEL-BUSCA-A).
  Roda: node --test src/lib/busca/e590-nivel-sempre-opcoes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEXTO_SEM_NIVEIS, grupoNivel } from "./filtro-nivel.ts";

const pilulas = () => readFileSync(new URL("../../components/busca/barra-pilulas.tsx", import.meta.url), "utf8");

test("o painel do Nível renderiza as 3 opções com contador sem depender de haver nível na busca", () => {
  const s = pilulas();
  const bloco = s.slice(s.indexOf('aberto === "nivel"'), s.indexOf('aberto === "ordenar"'));
  assert.doesNotMatch(bloco, /nivel\.visivel \?/, "as opções não ficam atrás do 'visivel'");
  assert.match(bloco, /NIVEIS\.map\(\(v\) =>\s*opcao\(v, f\.nivelMin === v, porNivel\[v\], nivel\.desabilitado\[v\]/);
  assert.match(bloco, /\{!nivel\.visivel && \(\s*<p[^>]*data-testid="painel-nivel-vazio"[^>]*>\s*\{TEXTO_SEM_NIVEIS\}/);
});

test("contadores: com nível, aplicáveis; zero = desabilitado (a escolhida nunca trava)", () => {
  assert.deepEqual(grupoNivel({ essencial: 8, conforto: 0, premium: 0 }, "").desabilitado, { essencial: false, conforto: true, premium: true });
  assert.deepEqual(grupoNivel({ essencial: 0, conforto: 0, premium: 0 }, "").desabilitado, { essencial: true, conforto: true, premium: true });
  assert.equal(grupoNivel({ essencial: 0, conforto: 0, premium: 0 }, "conforto").desabilitado.conforto, false);
});

test("a nota não contradiz as opções na tela (não diz que os níveis 'aparecem quando…')", () => {
  assert.doesNotMatch(TEXTO_SEM_NIVEIS, /aparecem quando/);
  assert.match(TEXTO_SEM_NIVEIS, /padrão mínimo confirmado/);
});
