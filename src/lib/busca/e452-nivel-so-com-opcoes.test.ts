/* Roda: node --test src/lib/busca/e452-nivel-so-com-opcoes.test.ts
  E452 (rodada pública, 02/11; resposta do Muse 05/11): o filtro "Nível" era um beco sem saída — o painel só trazia texto
  explicativo e o "Fechar", numa busca com 15 resultados. Regra do item: ou o filtro oferece os níveis, ou não aparece
  como filtro. A pílula "Nível" só está na barra quando há o que escolher: pelo menos um nível com anúncio no resultado
  atual (contagens do resultado, não do catálogo) ou um nível já escolhido (para poder desligar). As três contagens
  zeradas e nada escolhido → sem pílula, e nunca um painel só com texto.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { grupoNivel } from "./filtro-nivel.ts";

const pilulas = () => readFileSync(new URL("../../components/busca/barra-pilulas.tsx", import.meta.url), "utf8");

test("grupoNivel: visível com algum nível no resultado ou um nível escolhido; as três em zero e nada escolhido = fora", () => {
  assert.equal(grupoNivel({ essencial: 4, conforto: 0, premium: 0 }, "").visivel, true);
  assert.equal(grupoNivel({ essencial: 0, conforto: 0, premium: 1 }, "").visivel, true);
  assert.equal(grupoNivel({ essencial: 0, conforto: 0, premium: 0 }, "").visivel, false);
  // ?nivel=premium que zerou: a pílula fica (ativa) para o morador desligar o filtro.
  assert.equal(grupoNivel({ essencial: 0, conforto: 0, premium: 0 }, "premium").visivel, true);
});

test("a barra só desenha a pílula Nível quando o grupo é visível, e o painel nunca é só texto", () => {
  const s = pilulas();
  assert.match(s, /\{nivel\.visivel && pilula\("nivel"\)\}/);
  assert.doesNotMatch(s, /painel-nivel-vazio|TEXTO_SEM_NIVEIS/, "sem nota explicativa no lugar das opções");
  // Painel aberto de uma busca que ficou sem nível (filtros mudaram): fecha, não vira painel vazio.
  assert.match(s, /abertoRaw === "nivel" && !nivel\.visivel \? null : abertoRaw/);
});

test("as 3 opções seguem com contador (zero desabilitado)", () => {
  const s = pilulas();
  const bloco = s.slice(s.indexOf('aberto === "nivel" &&'), s.indexOf('aberto === "ordenar"'));
  assert.match(bloco, /NIVEIS\.map\(\(v\) =>\s*opcao\(v, f\.nivelMin === v, porNivel\[v\], nivel\.desabilitado\[v\]/);
});
