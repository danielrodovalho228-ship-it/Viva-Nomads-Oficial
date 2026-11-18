import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { esquecerLeitura, leituraPartilhada } from "./leitura-partilhada.ts";

/**
 * E1025 — a casca do painel fazia a mesma leitura no servidor várias vezes ao abrir cada tela: `ehParceiroAprovado`
 * 3 a 4 vezes (uma por componente que usa `useParceiroAprovado`) e `getMyAvatarUrl` 1 a 3 vezes. Medido em 18/11/2026:
 * 9 ações de servidor ao abrir /dashboard, 7 em /dashboard/assinatura, 5 em /dashboard/mensagens.
 * A leitura passa a ser uma por conta e por abertura de tela, repartida por quem pedir.
 */
const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("pedidos ao mesmo tempo com a mesma chave fazem UMA leitura e recebem a mesma resposta", async () => {
  let chamadas = 0;
  let soltar!: (v: boolean) => void;
  const lerNoServidor = () => { chamadas++; return new Promise<boolean>((r) => (soltar = r)); };
  const a = leituraPartilhada("t1:conta-1", lerNoServidor, 5_000);
  const b = leituraPartilhada("t1:conta-1", lerNoServidor, 5_000);
  const c = leituraPartilhada("t1:conta-1", lerNoServidor, 5_000);
  assert.equal(chamadas, 1);
  soltar(true);
  assert.deepEqual(await Promise.all([a, b, c]), [true, true, true]);
});

test("a resposta vale só pela abertura da tela: dentro do prazo não relê, passado o prazo relê", async () => {
  let chamadas = 0;
  let relogio = 1_000;
  const lerNoServidor = async () => ++chamadas;
  assert.equal(await leituraPartilhada("t2:conta-1", lerNoServidor, 5_000, () => relogio), 1);
  relogio += 4_999;
  assert.equal(await leituraPartilhada("t2:conta-1", lerNoServidor, 5_000, () => relogio), 1, "ainda a mesma abertura");
  relogio += 2;
  assert.equal(await leituraPartilhada("t2:conta-1", lerNoServidor, 5_000, () => relogio), 2, "abertura seguinte lê de novo");
});

test("outra conta neste aparelho não herda a leitura (a chave leva a conta)", async () => {
  const visto: string[] = [];
  const de = (conta: string) => async () => { visto.push(conta); return conta; };
  assert.equal(await leituraPartilhada("t3:conta-1", de("conta-1"), 5_000), "conta-1");
  assert.equal(await leituraPartilhada("t3:conta-2", de("conta-2"), 5_000), "conta-2");
  assert.deepEqual(visto, ["conta-1", "conta-2"]);
});

test("leitura que falha não fica guardada: quem pedir depois tenta de novo", async () => {
  let chamadas = 0;
  const falha = async () => { chamadas++; throw new Error("sem rede"); };
  await assert.rejects(leituraPartilhada("t4:conta-1", falha, 5_000), /sem rede/);
  await assert.rejects(leituraPartilhada("t4:conta-1", falha, 5_000), /sem rede/);
  assert.equal(chamadas, 2);
  // E quem estava à espera da mesma leitura recebe o mesmo erro (não fica pendurado).
  let soltar!: (e: Error) => void;
  const pendente = () => new Promise<never>((_, rej) => (soltar = rej));
  const x = leituraPartilhada("t4b:conta-1", pendente, 5_000);
  const y = leituraPartilhada("t4b:conta-1", pendente, 5_000);
  soltar(new Error("caiu"));
  await assert.rejects(x, /caiu/);
  await assert.rejects(y, /caiu/);
});

test("esquecerLeitura: depois de a pessoa mudar o dado (foto nova), a leitura seguinte vai ao servidor", async () => {
  let chamadas = 0;
  const lerNoServidor = async () => ++chamadas;
  assert.equal(await leituraPartilhada("t5:conta-1", lerNoServidor, 5_000), 1);
  esquecerLeitura("t5:conta-1");
  assert.equal(await leituraPartilhada("t5:conta-1", lerNoServidor, 5_000), 2);
});

test("a casca usa a leitura partilhada: ninguém chama ehParceiroAprovado nem getMyAvatarUrl direto ao montar", () => {
  const leituras = ler("./leituras-da-casca.ts");
  assert.match(leituras, /leituraPartilhada\(`parceiro:\$\{conta\}`, ehParceiroAprovado, PARTILHA_MS\)/);
  assert.match(leituras, /leituraPartilhada\(`avatar:\$\{conta\}`, getMyAvatarUrl, PARTILHA_MS\)/);
  // A chave leva a conta do store (outra conta no mesmo aparelho não herda).
  assert.match(leituras, /useAuthStore\.getState\(\)\.user\?\.id/);

  const hook = ler("../use-papel-barra.ts");
  assert.match(hook, /lerParceiroAprovado\(\)/);
  assert.doesNotMatch(hook, /ehParceiroAprovado\(\)/);

  for (const arq of ["../../components/layout/dashboard-shell.tsx", "../../components/layout/navbar.tsx", "../../components/account/convite-foto-perfil.tsx", "../../components/account/convite-foto-candidatura.tsx"]) {
    const src = ler(arq);
    assert.match(src, /lerMeuAvatar\(\)/, arq);
    assert.doesNotMatch(src, /getMyAvatarUrl\(\)/, arq);
  }
});

test("foto nova: a tela da foto esquece a leitura guardada antes de ler a URL nova", () => {
  const foto = ler("../../components/account/foto-perfil.tsx");
  // A primeira leitura da tela reparte com a casca; depois de enviar a foto, a leitura é nova.
  assert.match(foto, /lerMeuAvatar\(\)/);
  assert.match(foto, /esquecerMeuAvatar\(\);\s*\n\s*const nova = await getMyAvatarUrl\(\);/);
});
