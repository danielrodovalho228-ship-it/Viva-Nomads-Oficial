# E674 (resíduo) — carga direta de /dashboard/contratos caiu em /auth com a sessão viva

- **Relato**: logado como Paulo, a carga completa direta de `/dashboard/contratos` foi 1x para `/auth`; a mesma lista abre por navegação interna.
- **Leitura do código** (não reproduzido ao vivo): a página não tem guarda própria (o `proxy.ts` barra sem sessão; o servidor lê o cookie). Quem manda para `/auth` é o `AuthGuard` do cliente, quando `authChecked && !user`. Na carga completa o `AuthProvider` chama `getSession()`; se ela devolve "sem sessão" por um instante (renovação do token, duas abas), `hydrate(null)` chama `setUser(null)`, que apaga o usuário persistido e marca `authChecked`. A navegação interna não refaz essa leitura, por isso funciona.
- **Correção**: antes de declarar deslogado, o `AuthProvider` confere uma vez com `getUser()` (validado no servidor) e relê a sessão; falha de rede segue como "sem sessão". Sem sessão real, o caminho para `/auth` continua o mesmo.
- **Teste**: `src/lib/sessao/e674-carga-direta-sem-sessao-transitoria.test.ts` (visto vermelho antes). `src/lib/sessao`: 10 ok; `tsc` limpo.
- **Sem** migração, chave ou prova ao vivo. Se a QA ainda vir o caso, preciso do horário e se houve outra aba/renovação no momento.
