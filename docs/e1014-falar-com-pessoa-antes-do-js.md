# E1014 — instabilidade do t108: "Falar com uma pessoa" não se perde antes do JavaScript

## Sintoma
t108 (tela do chamado no admin) estourava os 90 s na primeira tentativa (3 das 7 corridas de 16 e 17/11; ex.: run
44070223214, fatia 1/20, 1280 px) e passava na segunda.

## Causa (provada no lab, main d27e5b19)
O t108 abre o chamado pelo chat da /ajuda/fale-com-a-viva ("Falar com uma pessoa" → formulário "Abrir chamado").
Com a máquina carregada (6 workers, t108 `--repeat-each=10`): **9 de 20 falharam**, todas paradas em
`waiting for locator('#abrir-chamado').getByLabel('O que aconteceu?')`. A tela mostra o chat e nenhum formulário: o toque
chegou antes do JavaScript da página, o botão ainda não tinha ação e o toque sumiu em silêncio. Como as ações do
Playwright não têm limite próprio, o teste espera até o limite do teste inteiro.

É defeito do produto, não só do teste: quem toca "Falar com uma pessoa" com a página ainda carregando perde o toque.

## Correção
`src/components/ajuda/viva-chat.tsx`: o botão fica dentro de um formulário GET para `/ajuda/fale-com-a-viva?doChat=1`
(a rota única do chat, que a Central já abre no "Abrir chamado"). Antes do JavaScript, o toque leva à rota; com a página
pronta, o clique segue pelo evento de sempre (sem recarregar). O botão continua botão.

## Trava — t2203 (nova)
O JavaScript da página chega 4 s atrasado e o toque vem logo que o botão aparece; o formulário do chamado tem de abrir.

| Onde | Resultado |
|---|---|
| main d27e5b19, lab, t2203 `--repeat-each=3`, sem retry | 6 de 6 vermelhos ("E1014: o toque abriu o formulário do chamado") |
| ramo, lab, t2203 `--repeat-each=3` | 6 passed |
| main, lab, t108 `--repeat-each=10 --workers=6` | 9 de 20 falharam (formulário não abre) |
| ramo, lab, t108 `--repeat-each=10 --workers=6` | 20 passed |
| ramo, lab, specs do chat e da Central (t19, t24, t25, t42, t199, t598, t789, t836) | 32 passed, 1 skipped |
| npm test | 7796 pass, 0 fail; guardas do laboratório 266/0 |

## Quarentena
A entrada do t108 (E1014) sai neste PR.
