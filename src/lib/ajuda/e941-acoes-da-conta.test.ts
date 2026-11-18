/*
  E941 — seguimento (julgamento da ronda das 03:00: PARCIAL). O mecanismo de ligações já estava vivo, mas os 4 destinos do
  achado original seguiam texto simples: "Pausar", "Marcar como atendido", "Problema com isto?" e "parceiro de manutenção".
  Agora cada um liga, no próprio texto, a tela da conta onde a ação está. Quem não tem sessão passa por /auth e volta à
  mesma tela (proxy: /auth?redirect=<rota>).
  Roda: node --test src/lib/ajuda/e941-acoes-da-conta.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { pedacosComLigacoes } from "./remissoes.ts";
import { FAQ, respostaPara, type PerfilAjuda } from "../atendimento/faq.ts";

const PERFIS: PerfilAjuda[] = ["visitante", "sem_contrato", "com_contrato"];
const ACOES: { pergunta: RegExp; trecho: string; destino: string }[] = [
  { pergunta: /^Como cancelo um Pedido de Moradia/, trecho: "Pausar", destino: "/dashboard/pedidos" },
  { pergunta: /^Como cancelo um Pedido de Moradia/, trecho: "Marcar atendido", destino: "/dashboard/pedidos" },
  { pergunta: /^Algo quebrou no imóvel/, trecho: "Problema com isto?", destino: "/dashboard/contratos" },
  { pergunta: /^Algo quebrou no imóvel/, trecho: "parceiro de manutenção", destino: "/dashboard/solicitacoes" },
];

test("E941 seguimento — as 4 ações nomeadas ligam, no próprio texto, a tela da conta onde estão (todos os perfis)", () => {
  for (const a of ACOES) {
    const p = FAQ.find((q) => a.pergunta.test(q.pergunta));
    assert.ok(p, `a pergunta ${a.pergunta} existe`);
    for (const perfil of PERFIS) {
      const texto = respostaPara(p, perfil);
      assert.ok(texto.includes(a.trecho), `"${p.pergunta}" (${perfil}) nomeia "${a.trecho}"`);
      const links = pedacosComLigacoes(texto).filter((x) => x.href);
      assert.ok(
        links.some((l) => l.texto === a.trecho && l.href === a.destino),
        `"${a.trecho}" (${perfil}) liga ${a.destino}: ${JSON.stringify(links)}`,
      );
    }
  }
});

test("E941 seguimento — cada destino existe e mostra a ação que a resposta nomeia", () => {
  const ler = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
  for (const rota of ["pedidos", "contratos", "solicitacoes"]) {
    assert.ok(existsSync(new URL(`../../app/(dashboard)/dashboard/${rota}/page.tsx`, import.meta.url)), `/dashboard/${rota}`);
  }
  const pedidos = ler("app/(dashboard)/dashboard/pedidos/pedidos-client.tsx");
  assert.match(pedidos, /Pausar/);
  assert.match(pedidos, /Marcar atendido/);
  assert.match(ler("app/(dashboard)/dashboard/contratos/contratos-client.tsx"), /<ProblemaComIsto tipo="contrato"/);
  assert.match(ler("app/(dashboard)/dashboard/solicitacoes/page.tsx"), /<CartaoOrdem/);
  assert.match(ler("components/manutencao/cartao-ordem.tsx"), /Chamar um parceiro de manutenção/);
});

test("E941 seguimento — a rota da conta, sem sessão, volta à mesma tela depois de entrar (proxy com redirect)", () => {
  const proxy = readFileSync(new URL("../../proxy.ts", import.meta.url), "utf8");
  assert.match(proxy, /redirectUrl\.searchParams\.set\("redirect", destinoAposLogin\(pathname/);
});
