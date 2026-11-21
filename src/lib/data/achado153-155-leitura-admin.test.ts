/*
  Varredura de erros e estados vazios — rodada 33 (achados 153 a 155). Mesma família das rodadas 31 e 32, agora no admin:
  a falha ao LER o registro virava "Documento/Agente não encontrado" (ou "só quem criou aceita") e o admin achava que o
  registro tinha sumido. Agora a leitura destrutura o `error` e a falha diz "Não foi possível ler … agora. Tente de novo."
  ANTES de qualquer "não encontrado".
   153  Admin › Documentos › Emitidos › reenviar e-mail            — documentos_registro
   154  Central de Agentes › aceitar/reabrir ordem                  — agentes_ordens
   155  Central de Agentes › nova ordem (conferir o agente)         — agentes
  Roda: node --test src/lib/data/achado153-155-leitura-admin.test.ts
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
  { arquivo: "src/lib/data/emitidos-actions.ts", tabela: "documentos_registro", select: 'select("id, numero, ref_tabela, ref_id, status")', naoEncontrado: "Documento não encontrado." },
  { arquivo: "src/lib/data/agentes-actions.ts", tabela: "agentes_ordens", select: 'select("texto").eq("id", id)', naoEncontrado: "Só quem criou a ordem aceita ou reabre." },
  { arquivo: "src/lib/data/agentes-actions.ts", tabela: "agentes", select: 'select("nome, rotina_texto")', naoEncontrado: "Agente não encontrado." },
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
