# E727 + E728 — "Continuar" de /parceiros e o CNPJ que se perdia

## E727 — a sessão ativa era ignorada
**Sintoma (Phoenix):** logada, a pessoa clicava "Continuar" em /parceiros e era mandada a `/auth` (novo código por e-mail).
**Causa provável (código):** `/parceiros` lê a sessão no SERVIDOR (`minhaParceria`), mas a rota não estava no `matcher` do `src/proxy.ts`. O proxy é quem renova o token vencido e grava os cookies novos (E428); sem ele, a página via a pessoa logada como visitante (`estado.logado = false`) e o botão virava "Continuar: criar conta ou entrar", que vai a `/auth`.
**Correção (sem migração):** `/parceiros` e `/parceiros/:path*` entram no matcher do proxy. Com sessão ativa o botão é "Enviar pedido de parceria" e segue direto. O texto e o fluxo do formulário não mudam.
**Dúvida:** a causa é a inferida pelo código (a reprodução com token vencido é da QA). Se persistir com token válido, mandar o caminho exato.

## E728 — o CNPJ digitado se perdia no retorno do /auth
O rascunho que vai ao `/auth` (e volta) guardava tudo MENOS o documento. Agora o CNPJ vai junto: o formulário só aceita CNPJ (um CPF é recusado antes de ir ao `/auth`), o rascunho fica só em `sessionStorage` e sai do armazenamento quando a pessoa volta logada. Só o aceite continua sem ser guardado.

Teste: `src/lib/parceiros/e727-e728-continuar.test.ts`. Sem migração, sem prova ao vivo. `AUTOMACOES_ATIVO` intocado.
