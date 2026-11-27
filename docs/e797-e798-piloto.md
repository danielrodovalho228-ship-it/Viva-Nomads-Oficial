# E797 e E798: correção do piloto do E793 (prova ao vivo de 12/11, 🟡 parcial)

## E798: corrigido neste PR

**Sintoma (prova ao vivo):** `/dashboard/conta` e `/dashboard/conta/avaliacoes` abriam com a área principal em branco e redirecionavam no navegador.

**Causas:**
- **`/dashboard/conta/avaliacoes`:** a página fazia `redirect()` no servidor, mas está dentro do Suspense do `dashboard/loading.tsx`. O Next manda primeiro a casca (status 200), e o redirecionamento chega depois, no fluxo, e é feito pelo navegador. Na main, `GET /dashboard/conta/avaliacoes?aba=recentes` responde **200**, e não 307 (t1611, vermelho).
- **`/dashboard/conta`:** a página é de cliente e só redireciona no `useEffect` (`matchMedia` ≥ 1024 px → Perfil, decisão do E492). O servidor desenha o menu (escondido no computador), e o navegador troca de página depois.

**Correção** (`src/lib/conta/redirecionar-no-servidor.ts` e `src/proxy.ts`):
- O **proxy** redireciona antes de desenhar, com HTTP 307:
  - `/dashboard/conta/avaliacoes` → `/dashboard/avaliacoes?aba=recebidas` (com o filtro e a busca), sempre;
  - `/dashboard/conta` → `/dashboard/conta/perfil`, **no computador**.
- **Como o servidor sabe que é computador:** pelo cookie `vn-tela` (`larga`/`estreita`), que a casca do painel grava (`GravarLarguraDaTela`, em `useEffect`). Isso evita adivinhar pelo user-agent, que erraria com o iPad (que se anuncia como Mac).
- **Sem o cookie (1ª visita)** ou no celular, vale o comportamento de antes.
- **Âncoras antigas** (`/dashboard/conta#documento`…): o navegador mantém a âncora no redirecionamento, e o Perfil (`AncoraAntigaDaConta`) encaminha para a seção certa, com o mesmo `destinoDaAncora` de antes.
- **Cache:** o redirecionamento da Conta depende do cookie do aparelho e sai com `Cache-Control: private, no-store`. O ponto 9 do t1608 pegou isso.
- **Rede de segurança:** a página antiga de avaliações continua redirecionando, com a mesma função.

**Testes:**
- **Unitário** `src/lib/conta/e798-redirecionar-no-servidor.test.ts`.
- **E2E** `tests/e2e/specs/t1611-e798-conta-redireciona-no-servidor.spec.ts`:
  - avaliações → 307 com o destino;
  - 1280 px → 307 para o Perfil, a página de destino abre com o conteúdo e a âncora antiga vai a Dados;
  - 390 px → o menu da Conta, sem redirecionar.

## E797: reproduzido, mas a causa é outra, e corrigir pede decisão de desenho (não corrigido aqui)

**Sintoma (prova ao vivo):** `/dashboard` abre com um esqueleto por cerca de 1 a 3 s, mesmo estando no piloto.

**O que medi** no lab local, com a chave `piloto`, build de produção e as contas da massa da varredura (dono com imóveis e contratos, conta com três papéis, inquilina, parceiro):
- **HTML do servidor:** `/dashboard` sai **sem** `auth-guard-carregando` para todas as contas. O guarda do E793 está funcionando.
- **No navegador**, com MutationObserver, `auth-guard-carregando` **nunca** aparece. O que aparece é **outro** esqueleto, o `SkeletonLista` do `dashboard/loading.tsx` (o Suspense da rota). Ele é idêntico na aparência ao do guarda e fica de 50 a 250 ms no lab, enquanto a página do Início faz as suas leituras: 11 em paralelo e mais um 2º lote de 4 (`page.tsx`, com limite de 6 s cada).
- Em produção, com leituras mais lentas, isso vira o 1 a 3 s da prova ao vivo.

| Conta (lab) | esqueleto do Suspense aparece | conteúdo do Início aparece |
|---|---|---|
| DONO17 | 605 ms | 714 ms |
| TRES | 536 ms | 572 ms |
| INQUILINA | 561 ms | 611 ms |

(tempos desde o início da navegação; `auth-guard-carregando`: nunca)

**Por que não corrigi.** O "1º quadro com conteúdo real" no Início tem dois caminhos, e os dois mudam o desenho:
- **(a) Tirar o esqueleto de página inteira do Início:** a resposta só sai com tudo lido, e a tela anterior fica até lá.
- **(b) Dividir o Início em seções que chegam aos poucos:** topo e atalhos na hora, cada bloco de dados com o seu marcador.

A decisão não está registrada. Ver "Dúvidas" no PR.

## E799: fica para o PR seguinte

A prévia do perfil (`EspelhoPorPapel`) escolhe o papel pelo modo do painel. O modo vem do contexto do servidor e depois do store, que é acertado pelo `ModeInitializer`, pela leitura do `papel_ativo` no `AuthProvider` e pelo `SincronizarPapel`. A ordem entre eles varia de um carregamento para outro, e por isso a prévia alterna entre morador ("Paulo P.", nome público) e proprietário. A correção precisa de uma fonte única para o papel da prévia.
