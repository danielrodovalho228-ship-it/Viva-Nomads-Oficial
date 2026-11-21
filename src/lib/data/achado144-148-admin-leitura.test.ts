/*
  Varredura de erros e estados vazios — rodada 31 (achados 144 a 148). Nas ações de decisão do admin, a falha ao LER o registro
  (banco fora, rede) virava "Pedido/Documento/Item não encontrado": o admin achava que o registro tinha sumido e desistia ou
  decidia no escuro. Agora a leitura destrutura o `error` e a falha diz "Não foi possível ler … agora. Tente de novo." ANTES
  de qualquer "não encontrado". O "não encontrado" fica só para o registro de fato inexistente.
   144  Parceiros › conferir / aprovar / recusar pedido (parceiro_solicitacoes)
   145  Parceiros › tirar o selo de nota fiscal (chamados + parceiros)
   146  Documentos › reenviar e-mail (documentos_registro)
   147  Documentos › falha de emissão (documentos_falhas)
   148  (reservado: o mesmo teste cobre todos os pontos da lista PONTOS)
  Roda: node --test src/lib/data/achado144-148-admin-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

interface Ponto {
  arquivo: string;
  tabela: string;
  /** trecho único do select, para achar a leitura certa */
  select: string;
  /** o texto do "não encontrado" que NÃO pode aparecer quando a leitura falhou */
  naoEncontrado: string;
}

const PONTOS: Ponto[] = [
  { arquivo: "src/lib/parceiros/admin-actions.ts", tabela: "parceiro_solicitacoes", select: 'select("checklist, status")', naoEncontrado: "Pedido não encontrado." },
  { arquivo: "src/lib/parceiros/admin-actions.ts", tabela: "parceiro_solicitacoes", select: 'select("id, email, nome, user_id, status, checklist, documento")', naoEncontrado: "Pedido não encontrado." },
  { arquivo: "src/lib/parceiros/admin-actions.ts", tabela: "parceiro_solicitacoes", select: 'select("id, email, nome, user_id, status")', naoEncontrado: "Pedido não encontrado." },
  { arquivo: "src/lib/parceiros/admin-actions.ts", tabela: "chamados", select: 'select("id, categoria, contexto_tipo, contexto_id")', naoEncontrado: "Este chamado não é uma denúncia" },
  { arquivo: "src/lib/parceiros/admin-actions.ts", tabela: "parceiros", select: 'select("id, user_id, tipo_pessoa, emite_nota, nota_selo_removido_em")', naoEncontrado: "Parceiro não encontrado." },
  { arquivo: "src/lib/data/emitidos-actions.ts", tabela: "documentos_registro", select: 'select("id, numero, ref_tabela, ref_id, status")', naoEncontrado: "Documento não encontrado." },
  { arquivo: "src/lib/data/documentos-falhas-actions.ts", tabela: "documentos_falhas", select: 'select("pagamento_id, acerto_id, etapa")', naoEncontrado: "Item não encontrado." },
];

for (const p of PONTOS) {
  test(`${p.arquivo.split("/").pop()} › ${p.tabela} ${p.select.slice(0, 40)}…: a falha de leitura não vira "${p.naoEncontrado}"`, () => {
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
