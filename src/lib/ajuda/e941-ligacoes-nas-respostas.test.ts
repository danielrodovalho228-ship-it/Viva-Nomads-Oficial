/*
  E941 (Gerente, decidido): toda resposta da Central de ajuda que NOMEIA um destino liga-o dentro do próprio texto (o botão
  por baixo da resposta não conta); resposta que não nomeia nada não ganha ligação. O catálogo é o mesmo da trava t2064
  (Pista 3). Roda: node --test src/lib/ajuda/e941-ligacoes-nas-respostas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pedacosComLigacoes, pedacosComRemissoes } from "./remissoes.ts";
import { FAQ, respostaPara, type PerfilAjuda } from "../atendimento/faq.ts";

const CATALOGO: { pergunta: RegExp; nomeia: RegExp; destino: string }[] = [
  { pergunta: /^O morador paga alguma taxa/, nomeia: /publicar um Pedido de Moradia/, destino: "/pedidos" },
  { pergunta: /^Como cancelo um Pedido de Moradia/, nomeia: /Pedidos de moradia/, destino: "/pedidos" },
  { pergunta: /^Algo quebrou no imóvel/, nomeia: /Entre na sua conta/, destino: "/auth" },
  { pergunta: /^Pediram para eu pagar por fora/, nomeia: /Abra um chamado/, destino: "/ajuda/fale-com-a-viva" },
  { pergunta: /^Como confiro se um documento/, nomeia: /Conferir documento/, destino: "/conferir" },
  { pergunta: /^Não recebi o código de acesso/, nomeia: /Entrar/, destino: "/auth" },
  { pergunta: /^Não recebi o código de acesso/, nomeia: /abra um chamado/, destino: "/ajuda/fale-com-a-viva" },
  { pergunta: /^Esqueci minha senha/, nomeia: /Entrar/, destino: "/auth" },
  { pergunta: /^Como excluo a minha conta/, nomeia: /Excluir conta/, destino: "/excluir-conta" },
];
const PERFIS: PerfilAjuda[] = ["visitante", "sem_contrato", "com_contrato"];

test("cada resposta do catálogo liga, no próprio texto, o destino que nomeia (em todos os perfis em que nomeia)", () => {
  for (const ref of CATALOGO) {
    const p = FAQ.find((q) => ref.pergunta.test(q.pergunta));
    assert.ok(p, `a pergunta ${ref.pergunta} existe`);
    for (const perfil of PERFIS) {
      const texto = respostaPara(p, perfil);
      if (perfil !== "visitante" && !ref.nomeia.test(texto)) continue; // outra resposta para este perfil
      const links = pedacosComLigacoes(texto).filter((x) => x.href);
      assert.ok(
        links.some((l) => l.href === ref.destino && ref.nomeia.test(l.texto)),
        `"${p.pergunta}" (${perfil}) nomeia ${ref.nomeia} e liga ${ref.destino}: ${JSON.stringify(links)}`,
      );
    }
  }
});

test("o texto não muda: juntar os pedaços devolve a resposta inteira; nenhuma ligação vazia ou com '#'", () => {
  for (const p of FAQ) {
    for (const perfil of PERFIS) {
      const texto = respostaPara(p, perfil);
      const pedacos = pedacosComLigacoes(texto);
      assert.equal(pedacos.map((x) => x.texto).join(""), texto, p.pergunta);
      for (const l of pedacos) if (l.href !== null) assert.match(l.href, /^\/[^#\s]/, `${p.pergunta}: ${l.href}`);
    }
  }
});

test("resposta que não nomeia destino não ganha ligação; os guias seguem só com as remissões de caminho (E906)", () => {
  assert.deepEqual(pedacosComLigacoes("Qual o prazo? Depende do contrato."), [{ texto: "Qual o prazo? Depende do contrato.", href: null }]);
  assert.deepEqual(pedacosComRemissoes("Entre na sua conta."), [{ texto: "Entre na sua conta.", href: null }]);
  const ajuda = readFileSync(new URL("../../components/ajuda/central-ajuda.tsx", import.meta.url), "utf8");
  assert.match(ajuda, /<TextoComRemissoes texto=\{respostaPara\(p, perfil\)\} nomeados \/>/);
  const guia = readFileSync(new URL("../../app/(public)/guias/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(guia, /<TextoComRemissoes texto=\{p\} \/>/);
});
