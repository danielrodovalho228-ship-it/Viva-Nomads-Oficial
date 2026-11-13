# Frente 1: t132-solicitar-reserva, bisseção com o teste rodando a cada commit (12/11/2026)

Complementa `docs/frente1-t132-diagnostico.md` (#3729). Aquele diagnóstico achou o commit comparando textos. Este roda o próprio t132 em cada passo de um `git bisect` de verdade.

## 1. Janela no `lab_execucoes` (só pushes da main)
| Rodada | Commit | t132 |
|---|---|---|
| 09/11 15:24 UTC | `47d85e5b0` | passou 2, falhou 0 ← último verde |
| 09/11 16:34 UTC | `70b350547` | passou 0, falhou 2 ← primeiro vermelho |
| 12/11 00:10 UTC | `d32300e14` | passou 0, falhou 2 ← último vermelho |
| 12/11 01:11 UTC | `02a337e62` | passou 2, falhou 0 |

O arquivo do t132 não muda entre `47d85e5b0` e `d32300e14`. A diferença na janela é só de código.

## 2. Como rodei
- **Build:** cada commit foi construído do zero (`rm -rf .next && next build`) e servido com `next start`, em modo demonstração, sem Supabase.
- **Teste:** `t132` no Chromium com `TESTES_SO_PUBLICO=1`. O spec só abre o anúncio de exemplo `/imoveis/ube-001`, a 1280 e a 390 px.
- **Bisseção:** `git bisect run`, com `--first-parent`, de `47d85e5b0` (verde) até `70b350547` (vermelho).
- **Cuidado aprendido:** a primeira tentativa foi **descartada**. O `next-server` da rodada anterior ficou preso na porta 3000, e todos os passos testaram esse servidor velho. O script final derruba o `next-server` antes de cada passo, aborta com `EADDRINUSE` e registra o `BUILD_ID` de cada commit.

## 3. Resultado (cada linha é um build próprio)
```
47d85e5b0 build_id=gPvfKGjJig5ht3s-20PGv  t132: 2 passed      (ponta verde, medida aqui)
d32300e14 build_id=ISOlEeYvwm56ncJ7RU__U  t132: 2 failed      (ponta vermelha, medida aqui)
0425d5f37 build_id=DXgx0JHlY7Idx3NvAslwK  t132: 2 failed      (bisect: bad)
301be0a28 build_id=KlEWrx3FQ_o6M7P_Yz7l8  t132: 2 failed      (bisect: bad)
9c2417411 build_id=TbhEwAF4szXfmWSvTSbA-  t132: 2 passed      (bisect: good)
=> first bad commit: 301be0a28 (merge do #3408, claude-a/e713-coluna-reserva)
Dentro do #3408:
9ff375c1d build_id=mz4t9PE9ejpANxWHnnzpY  t132: 2 passed
d02f79e39 build_id=Ex0N3dzu0ejuJjWdsc8td  t132: 2 failed      <= o commit que quebrou
Main atual:
47f987f4d build_id=MznSUzo5GlTfU_e7ZSmhk  t132: 2 passed
```

## 4. Causa
`d02f79e39` (08/11 12:26 UTC), "E713 (resíduo): a coluna do exemplo também perde o aviso 'esta solicitação não é enviada'". Ele tira do cartão do exemplo o parágrafo `aviso-demo` (`EXEMPLO_AVISO_DEMO` = "Anúncio de exemplo: esta solicitação não é enviada."). O t132 ainda esperava o texto "Anúncio de exemplo".

A mudança é **decisão registrada**, não defeito:
- achado **D-E713-a**, da QA do Muse de 08/11 (`docs/qa-medicao-log.md`, linhas de E713 e "R1 / E713");
- observação **O12** da rodada 06:25 (`docs/qa-rodadas/2026-11-08-0625.md`): o título "esta solicitação não é enviada" aparecia sem haver solicitação.

Por isso **não há código a corrigir**: o cartão está como foi decidido. O que ficou velho foi a asserção, acertada em `24902a83c` (E744, mesclado com o #3588 em 11/11) para `/anúncio é de exemplo/i`. Essa asserção continua cobrindo o que o E694 pede: o cartão explica que o anúncio é de exemplo.
