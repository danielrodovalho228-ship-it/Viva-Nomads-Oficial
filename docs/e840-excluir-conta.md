# E840: "Excluir conta" com um rótulo e o destino pelo contexto

Foto da main: `27dbdf1`.

## Antes

| Onde | Rótulo | Destino |
|---|---|---|
| Rodapé (todas as páginas públicas, inclusive Termos e Privacidade) | "Excluir conta" | `/excluir-conta`, logado ou não |
| `/privacidade`, §8 (texto da política) | "Excluir conta" | `/excluir-conta` |
| Conta → Privacidade (logado) | "Excluir minha conta" | `/dashboard/conta/excluir` |
| `/excluir-conta`, caminho "pelo app" | "Conta → Excluir conta" (não existe com esse nome) | botão "Abrir Conta" → `/dashboard/conta` |

No código atual, `/para-proprietarios` não tem rodapé próprio: usa o mesmo `Footer` das outras páginas. Os dois destinos que a QA viu correspondem a quem estava logado ou não ao clicar no mesmo rótulo.

## Depois

- **Fonte única:** `src/lib/conta/excluir-conta.ts` define `ROTULO_EXCLUIR_CONTA = "Excluir conta"` e `destinoExcluirConta(logado)`, que devolve `/excluir-conta` para quem está deslogado e `/dashboard/conta/excluir` para quem está logado.
- **Rodapé:** usa `ExcluirContaNoRodape`, que lê a sessão do mesmo jeito que o "Entrar ou cadastrar" (E467). O servidor desenha o estado deslogado; depois de montar, quem está logado vai para a tela da conta.
- **Conta → Privacidade:** o link passa a dizer "Excluir conta".
- **`/excluir-conta`:** o texto agora ensina o caminho real ("Conta → Privacidade → Excluir conta"), e o botão "Excluir pelo app" abre direto a tela da conta.

## Teste

`node --test src/lib/conta/e840-excluir-conta.test.ts`:
- **main:** falha; o módulo da fonte única não existe, e o rodapé tem `href="/excluir-conta"` fixo.
- **branch:** 4 pass.

Testes do escopo (conta, excluir-conta, rotas do app, SEO das páginas públicas, saída, estilo, layout): **264 pass / 0 fail**. tsc limpo, consistência OK.
