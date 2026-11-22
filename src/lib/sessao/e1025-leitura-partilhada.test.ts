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
  // A chave leva a conta: a que o componente já conhece (no painel, a do 1.º quadro, que vem do servidor antes de o
  // store acordar); sem ela, a do store; sem nenhuma, a última conta que leu nesta página. Medido em 18/11: com a
  // chave só do store, a casca lia como "sem conta" e os outros com a conta — duas idas ao servidor pela mesma foto.
  assert.match(leituras, /const conhecida = dada \|\| useAuthStore\.getState\(\)\.user\?\.id \|\| null;/);
  assert.match(leituras, /return conhecida \?\? ultimaConta \?\? "sem-conta";/);

  const hook = ler("../use-papel-barra.ts");
  assert.match(hook, /lerParceiroAprovado\(userId\)/);
  assert.doesNotMatch(hook, /ehParceiroAprovado\(\)/);

  const comConta: Record<string, RegExp> = {
    "../../components/layout/dashboard-shell.tsx": /lerMeuAvatar\(displayUser\?\.id\)/,
    "../../components/layout/navbar.tsx": /lerMeuAvatar\(userId\)/,
    "../../components/account/convite-foto-candidatura.tsx": /lerMeuAvatar\(usuario\.id\)/,
    "../../components/account/convite-foto-perfil.tsx": /lerMeuAvatar\(\)/,
  };
  for (const [arq, chamada] of Object.entries(comConta)) {
    const src = ler(arq);
    assert.match(src, chamada, arq);
    assert.doesNotMatch(src, /getMyAvatarUrl\(\)/, arq);
  }
});

test("foto nova: a tela da foto esquece a leitura guardada antes de ler a URL nova", () => {
  const foto = ler("../../components/account/foto-perfil.tsx");
  // A primeira leitura da tela reparte com a casca; depois de enviar a foto, a leitura é nova.
  assert.match(foto, /lerMeuAvatar\(\)/);
  assert.match(foto, /esquecerMeuAvatar\(\);\s*\n\s*const nova = await getMyAvatarUrl\(\);/);
});

test("o painel não pré-carrega a página inicial: os logotipos da casca e do topo saem com prefetch={false}", () => {
  // Medido em 18/11/2026: com o pré-carregamento ligado, um pedido duplicado de `/?_rsc=…` ficava pendente no navegador
  // por cerca de 28 s em cada abertura de /dashboard (o cliente do Next só o aborta quando a entrada vence, aos 30 s).
  // A página inicial é a saída do painel, não o caminho de quem está a trabalhar nele: abre-se no clique.
  const logo = ler("../../components/ui/logo.tsx");
  assert.match(logo, /prefetch\?: boolean;/);
  assert.match(logo, /<Link href=\{href\} prefetch=\{prefetch\} /);
  const casca = ler("../../components/layout/dashboard-shell.tsx");
  assert.equal((casca.match(/<Logo /g) ?? []).length, 2, "os dois logotipos da casca");
  assert.equal((casca.match(/<Logo [^>]*prefetch=\{false\}/g) ?? []).length, 2);
  const topo = ler("../../components/layout/topo-dono.tsx");
  assert.match(topo, /<Logo href=\{HREF_LOGO_PAINEL\} prefetch=\{false\} /);
  // Fora do painel nada muda: o cabeçalho e o rodapé públicos seguem com o padrão do Next.
  for (const arq of ["../../components/layout/navbar.tsx", "../../components/layout/footer.tsx"]) assert.doesNotMatch(ler(arq), /<Logo [^>]*prefetch/, arq);
});

test("E1031: o link \"Voltar ao site\" da área do admin também não pré-carrega a página de saída", () => {
  // Medido em 19/11/2026 (auditoria do #3974): com o E1025 na main, /admin/agentes ainda levava 31 s a sossegar a rede.
  // Os logotipos já não pré-carregavam; quem pré-carregava a página inicial era este link, que só existe na área do
  // admin. Quatro pedidos `/?_rsc=…` ficavam pendentes 29 s e só terminavam abortados. O destino dele é a saída do
  // painel (a última página pública, ou a página inicial): abre-se no clique.
  const link = ler("../../components/layout/voltar-ao-site.tsx");
  assert.match(link, /<Link href=\{href\} prefetch=\{false\} /);
  assert.equal((link.match(/<Link /g) ?? []).length, 1, "um só link no componente");
  // É o único link de saída da casca fora dos logotipos: nenhum outro <Link> da casca aponta para a página inicial.
  const casca = ler("../../components/layout/dashboard-shell.tsx");
  assert.doesNotMatch(casca, /<Link[^>]*href=(\{"\/"\}|"\/")[ >]/);
  assert.match(casca, /<VoltarAoSite \/>/);
});

