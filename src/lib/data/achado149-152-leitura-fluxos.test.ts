/*
  Varredura de erros e estados vazios — rodada 32 (achados 149 a 152). Mesma família da rodada 31, agora nos fluxos do
  dono, do morador e do parceiro: a falha ao LER o registro (banco fora, rede) virava "Contrato/Pedido/Solicitação/Foto
  não encontrada" e a pessoa achava que o registro tinha sumido. Agora a leitura destrutura o `error` e a falha diz
  "Não foi possível ler … agora. Tente de novo." ANTES de qualquer "não encontrado".
   149  Estadia › instruções do check-in (contrato do imóvel)         — contratos
   150  Serviços do morador › mudar o estado do pedido                  — servicos_pedidos
   151  Manutenção › reclassificar a prioridade da solicitação          — service_orders
   152  Painel do parceiro › remover foto da galeria                    — parceiro_galeria
  Roda: node --test src/lib/data/achado149-152-leitura-fluxos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

interface Ponto {
  arquivo: string;
  tabela: string;
  select: string;
  naoEncontrado: string;
}

const PONTOS: Ponto[] = [
  { arquivo: "src/lib/data/estadia-actions.ts", tabela: "contratos", select: 'select("id").eq("id", contratoId)', naoEncontrado: "Contrato não encontrado." },
  { arquivo: "src/lib/data/servicos-morador-actions.ts", tabela: "servicos_pedidos", select: 'select("status")', naoEncontrado: "Pedido não encontrado." },
  { arquivo: "src/lib/data/manutencao-actions.ts", tabela: "service_orders", select: 'select("priority, prioridade_original, owner_id")', naoEncontrado: "Solicitação não encontrada." },
  { arquivo: "src/lib/parceiros/painel-actions.ts", tabela: "parceiro_galeria", select: 'select("path").eq("id", fotoId)', naoEncontrado: "Foto não encontrada." },
];

for (const p of PONTOS) {
  test(`${p.arquivo.split("/").pop()} › ${p.tabela}: a falha de leitura não vira "${p.naoEncontrado}"`, () => {
    const linhas = ler(p.arquivo).split("\n");
    const i = linhas.findIndex((l) => l.includes(`from("${p.tabela}")`) && l.includes(p.select));
    assert.ok(i >= 0, "a leitura existe");
    const janela = linhas.slice(i, i + 4).join("\n");
    assert.match(linhas[i], /const \{ data(: \w+)?, error: (\w+) \} = await/, "destrutura o error da leitura");
    const erro = /error: (\w+) \}/.exec(linhas[i])![1];
    const iFalha = janela.search(new RegExp(`if \\(${erro}\\) return \\{ ok: false, (erro|error): [^}]*Não foi possível ler`));
    const iNaoAchou = janela.indexOf(p.naoEncontrado);
    assert.ok(iFalha >= 0, `a falha de leitura (${erro}) responde "Não foi possível ler … agora"`);
    assert.ok(iNaoAchou < 0 || iFalha < iNaoAchou, 'a falha vem ANTES do "não encontrado"');
  });
}
