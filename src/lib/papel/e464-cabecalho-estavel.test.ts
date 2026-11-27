/**
 * E464 (chat principal): cabeçalho instável nas páginas de Conta.
 *  1) o menu de cima alternava entre o conjunto do dono e o do parceiro: a casca lia "parceria aprovada?" do servidor
 *     DEPOIS de montar e, até a resposta, tratava a conta como não aprovada — com o papel parceiro escolhido (gravado e
 *     guardado no aparelho), a 1ª pintura saía como proprietário/morador e trocava para parceiro. Agora, enquanto a
 *     leitura não volta, vale o papel guardado; a resposta só corrige quando discorda (parceria encerrada).
 *  2) o sino sumia nas telas da Conta (E185 escondia ali): agora fica em todas as telas do painel, como no resto.
 *  3) o menu Conta mudava com o papel que trocava sozinho — com o papel estável, o menu também fica.
 * `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parceiroAprovadoAgora } from "./aprovado-enquanto-le.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("enquanto a leitura não volta, vale o papel guardado; a resposta vence quando chega", () => {
  assert.equal(parceiroAprovadoAgora(null, true), true, "escolheu parceiro: já nasce parceiro");
  assert.equal(parceiroAprovadoAgora(null, false), false);
  assert.equal(parceiroAprovadoAgora(true, false), true);
  assert.equal(parceiroAprovadoAgora(false, true), false, "parceria encerrada: o servidor corrige");
});

test("a casca usa a regra e guarda a leitura por conta (outra conta no aparelho não herda)", () => {
  const h = ler("lib/use-papel-barra.ts");
  assert.match(h, /parceiroAprovadoAgora\(lido && lido\.id === userId \? lido\.ok : null, preferencia\)/);
  assert.match(h, /setLido\(\{ id: userId, ok: t \}\)/);
});

test("o sino aparece também nas telas da Conta (topo do computador)", () => {
  const topo = ler("components/layout/topo-dono.tsx");
  assert.doesNotMatch(topo, /secaoDaRota\(p\.pathname\) === null && <Sino/);
  assert.match(topo, /<Sino px=\{px\} notificacoes=\{p\.notificacoes\} \/>\s*<MenuConta/);
});
