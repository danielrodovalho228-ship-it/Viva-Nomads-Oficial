# L-33 / L-4 — referências visuais para o QA do Muse (t245, t263, t271)

Pista C, 23/10 à noite. **Nada foi atualizado.** Este arquivo lista o que difere da linha de base e como conferir. A linha de base só muda com o OK registrado abaixo.

## Onde ver o diff

No lab-crítico do PR da vigia que adicionou este arquivo, o artefato `lab-critico-<run>` (Actions → o run do PR → Artifacts) traz, para cada captura que falha, três imagens em `tests/e2e/.artifacts/<teste>/`:

- `*-expected.png`: a linha de base atual, em `tests/e2e/visual/<spec>/`;
- `*-actual.png`: a tela de hoje;
- `*-diff.png`: os pixels diferentes, em vermelho.

## O que difere (laboratório completo de `0a221bf`, igual em todo laboratório desde 22/10 15h52)

Limite do projeto: `maxDiffPixelRatio: 0.01` (1 %). A diferença foi a mesma em todas as execuções, então é uma tela que mudou, e não instabilidade.

| Spec | Captura | 390 px | 1280 px | Observação |
|---|---|---|---|---|
| t245 | 02 home (cartões em destaque) | 6 % | 4 % | |
| t245 | 03 /buscar | 2 % | 2 % | |
| t245 | 05 /favoritos vazio | 3 % | 2 % | |
| t245 | 06 /favoritos com 2 imóveis | 2 % | 2 % | |
| t245 | 07 /cidades/uberlandia | 4 % | 3 % | |
| t245 | 08 página do imóvel (topo) | 3 % | 2 % | **esperar o #1190 (L-31)** |
| t245 | 09 imóveis parecidos (cartão) | 5 % | 2 % | depende da página do imóvel: **esperar o #1190** |
| t245 | 11 /precos | 2 % | 2 % | |
| t245 | 13 /auth | 16 % | 6 % | entrada única do Prompt 49 |
| t245 | 14 /dashboard (inquilino) | 10 % | 5 % | |
| t245 | 17 /dashboard/conta | 6 % | 3 % | |
| t245 | 18 /dashboard (dono) | 7 % | 5 % | |
| t245 | 19 /dashboard/imoveis | 9 % | **49 %** | maior diferença: conferir com cuidado |
| t245 | 20 /dashboard/conta/seguranca | 3 % | — | |
| t263 | 01 página do imóvel inteira (ube-001) | 5 % | sem medida | a 1280 a página não abriu (L-31): **esperar o #1190** |
| t263 | 02 barra inferior (inquilino) | 2 % | — | |
| t263 | 03 barra inferior (proprietário) | 2 % | — | |
| t263 | 06 cogumelo da estadia (morador antes) | 2 % | — | |
| t271 | /admin | 23 % | 13 % | |
| t271 | /admin/documentos | 12 % | 9 % | fila nova do E28 (#1168) |

## Para aprovar

1. O Muse confere o `*-diff.png` e o `*-actual.png` de cada linha e marca aqui `aprovada` ou `defeito (L-n)`.
2. Só as aprovadas são regeradas. O comando roda no runner do laboratório, que tem as mesmas fontes e o mesmo Chromium da linha de base:
   `npx playwright test tests/e2e/specs/t245-visual-regressao.spec.ts tests/e2e/specs/t263-visual-41.spec.ts tests/e2e/specs/t271-admin-visual.spec.ts --project=chromium --update-snapshots`.
   Depois, entram no PR só os PNGs aprovados de `tests/e2e/visual/`.
3. As da página do imóvel (t245 08 e 09, t263 01) esperam o #1190 (L-31). Hoje a captura pode sair de uma página com erro.

| Captura | Decisão do Muse |
|---|---|
| (preencher) | |
