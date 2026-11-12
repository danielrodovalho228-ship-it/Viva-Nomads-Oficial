# E793 — desenho: o painel desenhado no servidor, com a sessão conferida lá

Status: **desenho para validar, sem implementação.** Também responde à reprova do **E789** na rodada de provas nº 2 (Conta/Perfil ainda abre com cartões-esqueleto na primeira abertura): a correção estrutural é esta.

## 1. Diagnóstico (código de hoje)

1. **Layout do painel.** `src/app/(dashboard)/layout.tsx` (vale para `/dashboard`, `/admin` e `/qualificar`) envolve **todo** o painel em `<AuthGuard>`, um componente de cliente.
2. **O guarda espera o navegador.** `AuthGuard` (`src/components/layout/auth-guard.tsx`) devolve `auth-guard-carregando` (`SkeletonLista`) enquanto `useAuthStore().user` for `null`. Esse `user` só existe no navegador:
   - vem do `AuthProvider` (`src/components/auth-provider.tsx`): `supabase.auth.getSession()`, depois `getUser()` quando precisa, depois a leitura de `profiles`;
   - ou da reidratação do localStorage (`zustand persist`, chave `vivanomads-auth`).
3. **No servidor, sempre esqueleto.** No servidor o store está vazio, então o HTML de toda tela do painel sai como esqueleto. O conteúdo que as páginas de servidor já desenharam (as **38** páginas do admin e 60 das 69 do dashboard, contando `/dashboard/conta/[secao]`) vai no payload RSC, mas **não é mostrado** até:
   1. o JavaScript baixar e hidratar;
   2. o `AuthProvider` conferir a sessão;
   3. o guarda liberar.

   No laboratório isso dá **~0,75 a 1,5 s** de esqueleto em todas as telas (medido na reprova do E789).
4. **Caso Perfil (E789).** `/dashboard/conta/[secao]` já é página de servidor e lê o perfil antes de desenhar (`getPerfilInicial`). Mesmo assim abre com esqueleto, porque o **guarda** esconde o HTML pronto. A correção do E789 fez a parte dela; a que falta é esta.
5. **A sessão já é conferida no servidor.** O `src/proxy.ts` já verifica a sessão para `/dashboard`, `/admin`, `/qualificar` e `/pedidos`: sem sessão manda para `/auth?redirect=…`, e não-admin no `/admin` recebe 404. O guarda de cliente é a **segunda** conferência do mesmo fato.

## 2. Arquitetura alvo

```
proxy.ts (já confere a sessão e redireciona)
   └─ (dashboard)/layout.tsx  [servidor]
        ├─ usuario = await usuarioDaSessaoServidor()     ← NOVO: getClaims() (JWT local) ou getUser(), + 1 leitura de profiles
        ├─ sem usuario → redirect("/auth?redirect=…")     ← rede de segurança (o proxy já cobre)
        └─ <SessaoServidor usuario={usuario}>           ← NOVO: contexto de cliente, semeado por PROP (não pelo store global)
             <AuthGuard>                                ← passa a liberar já no 1º quadro quando há sessão do servidor
               <ModeInitializer …/> <SincronizarPapel/> <ContadoresIniciais …>
                 <DashboardShell>{children}</DashboardShell>
```

Peças:
- **`usuarioDaSessaoServidor()`** (`src/lib/auth/sessao-servidor.ts`, `server-only`, com `cache()` por requisição):
  - lê `getClaims()` (verifica o JWT sem ida ao servidor de autenticação, se as chaves do projeto forem assimétricas) ou, senão, `getUser()`;
  - lê **uma** linha de `profiles` (`full_name, role, preferred_mode, papel_ativo, is_teste`), a mesma leitura do `AuthProvider`;
  - devolve o `SessionUser` que o cliente já usa.
- **`SessaoServidor`** (cliente): só um `Context` com o `SessionUser` do servidor.
  - **Nunca** escreve no `useAuthStore` durante o render no servidor, porque o store do zustand é um módulo **compartilhado entre requisições** no servidor e vazaria a sessão de uma pessoa para outra.
  - No cliente, um `useEffect` copia o usuário para o store, se ainda estiver vazio, para os componentes que já leem o store.
- **`AuthGuard`** passa a liberar com `user ?? usuarioDoContexto`. O redirecionamento para `/auth` continua o mesmo (quando o cliente confere e não há sessão), só que agora como **segunda** linha.
- **`useUsuarioAtual()`**: hook único `store.user ?? contexto`. Os componentes do painel que hoje leem `useAuthStore((s) => s.user)` para **desenhar** migram para ele, onda a onda, para que o primeiro quadro (servidor) e o da hidratação (cliente) desenhem o mesmo usuário.
- **Chave `PAINEL_SESSAO_SERVIDOR`**, desligada por padrão. Com ela desligada, nada muda. Liga-se por onda. O desligamento é o rollback imediato, sem deploy de código.

Custo no servidor: uma verificação de sessão (local com `getClaims`; com `getUser`, cerca de 50–150 ms até o Supabase Auth) e uma leitura de `profiles` por navegação dura. Nas navegações dentro do painel o layout não roda de novo (layout persistente do App Router).

## 3. Riscos de hidratação e mitigação

| # | Risco | Onde aparece | Mitigação |
|---|---|---|---|
| H1 | **Sessão vazando entre requisições**: semear o store global do zustand no servidor | qualquer `setUser` no render | o usuário do servidor só passa por **prop + Context**; guarda estático proíbe `useAuthStore.setState`/`setUser` em código que roda no servidor (busca por `"use client"` + render) |
| H2 | **HTML do servidor ≠ primeiro render do cliente** porque um componente lê do **localStorage** (`activeMode`, `parceiroAtivo`, preferências) | casca (`DashboardShell`), selo de papel, menus | o modo inicial já vem do servidor (`ModeInitializer` com `resolveInitialMode`); os componentes de desenho leem modo/papel por `useUsuarioAtual()`/props do servidor e só passam ao valor persistido **depois** de montar (`useEffect`), nunca no 1º render |
| H3 | **Data/hora** (`new Date()`, "há 3 min", fuso) | listas, sino, agenda | formatar com `dataBRT`/`hojeBR` a partir de um "agora" calculado no servidor e passado por prop; tempo relativo só depois de montar |
| H4 | **Dados do usuário divergentes** (nome mudou entre o servidor e a conferência do cliente) | avatar, saudação | o cliente só **substitui** o usuário do servidor quando a conferência termina, e a troca é uma atualização normal, não um erro de hidratação |
| H5 | **Sessão expirada entre o proxy e o layout** | renovação de token | o layout usa o mesmo cliente de cookies do proxy; se não houver usuário, `redirect` (servidor). O guarda do cliente fica como 2ª linha |
| H6 | **Componentes que dependem de `window`/`matchMedia`** no render | casca (celular × computador), modo app | já tratados por CSS (`lg:`) na maior parte; o resto continua dentro de `useEffect`. Inventário no piloto, tela a tela |
| H7 | **Modo demonstração** (`useDisplayUser` → `DEMO_USER`) | sem Supabase | sem cliente de servidor (demo) o layout passa `usuario = null` e o guarda age como hoje (demo resolvido no cliente) |
| H8 | **Admin observador e 2FA** (aal2) | `/admin` | o proxy já decide o portão de MFA antes do layout; o layout não muda essa regra, só lê o usuário que o proxy deixou passar |

Detecção: em desenvolvimento o React aponta qualquer diferença de hidratação no console. Cada spec de prova (seção 5) falha se aparecer `Hydration failed` ou `did not match` no console da página.

## 4. Ordem de migração (ondas)

| Onda | Telas | Por quê |
|---|---|---|
| **0 — base** | layout + `usuarioDaSessaoServidor` + `SessaoServidor` + `useUsuarioAtual` + `AuthGuard` com a 2ª linha, tudo atrás de `PAINEL_SESSAO_SERVIDOR` (desligada) | nada visível muda; testes de unidade da peça nova |
| **1 — piloto** | `/dashboard` (início), `/dashboard/conta`, `/dashboard/conta/[secao]` (**Perfil, E789**), `/dashboard/conta/avaliacoes`, `/dashboard/conta/excluir` | a reprova do E789 e a tela mais vista; a casca inteira entra junto (é dela o maior risco H2) |
| **2 — admin** | as 38 telas de `/admin` (todas de servidor) | já desenham no servidor; o ganho é imediato, com pouco risco (casca do admin mais simples) |
| **3 — painel de servidor** | as demais telas do dashboard que são de servidor e não buscam dados no cliente | mesmo padrão do piloto |
| **4 — dados no cliente** | telas cuja página ou árvore busca dados no navegador (`useEffect` + fetch/supabase) | além do guarda, precisam levar a leitura para o servidor (como o E789 fez no Perfil); cada uma é uma correção pequena própria |

A lista por tela está no **Apêndice A**: 108 páginas, gerada do código de hoje. "Lê a sessão no cliente" e "busca dados no cliente" foram detectadas olhando a página e dois níveis de imports; é um indicador para ordenar as ondas, que será confirmado tela a tela na migração.

## 5. Critério de prova por tela

Métrica: **tempo até o primeiro conteúdo útil (TPCU)**, medido do `domcontentloaded` até o seletor **próprio da tela** (o `data-testid` do conteúdo, não o da casca) ficar visível, **sem** `auth-guard-carregando` em nenhum quadro.

Para cada tela migrada, um spec de laboratório (carga fria, contexto novo, sessão real) cobre quatro pontos:
1. **HTML do servidor:** o `page.content()` da resposta inicial (antes de qualquer JavaScript; `javaScriptEnabled: false` num segundo contexto) já contém o `data-testid` de conteúdo da tela e **não** contém `auth-guard-carregando`;
2. **TPCU ≤ 300 ms** a 390 e 1280 px. Hoje fica entre ~750 e 1500 ms;
3. **zero** avisos de hidratação no console;
4. **sem regressão de proteção:** contexto **sem** sessão → `/auth?redirect=…` (proxy), e não-admin em `/admin` → 404, como hoje.

Os quatro pontos falham hoje em toda tela, porque o HTML é o esqueleto. Isso dá o "vermelho antes" de cada onda. A prova ao vivo é dos trabalhadores de QA, como sempre.

## 6. Rollback e guardas
- `PAINEL_SESSAO_SERVIDOR` desligada devolve o comportamento de hoje (o guarda espera o cliente).
- Guardas estáticos novos:
  - o layout lê a sessão pelo `usuarioDaSessaoServidor`;
  - nenhum `setUser`/`setState` do store fora de `useEffect`;
  - o `AuthGuard` mantém o redirecionamento do cliente.
- Não toca em migração, `AUTOMACOES_ATIVO`, 2FA nem proxy.

## Dúvidas
1. **`getClaims` × `getUser`:** `getClaims` evita a ida ao Supabase Auth, mas depende de chave de assinatura assimétrica no projeto. Se o projeto ainda usa o segredo JWT simétrico, fica o `getUser` (um salto de rede por navegação dura). Vale conferir no painel do Supabase antes da Onda 0.
2. **Onda 4:** cada tela que busca dados no cliente vira item próprio (como o E789) ou entra no mesmo PR da onda? A proposta é item próprio, para a prova ser por tela.

## Apêndice A — inventário por tela (código de `origin/main` em 12/11)
| Tela (rota) | Página | Lê a sessão no cliente (até 2 níveis) | Busca dados no cliente (useEffect+fetch/supabase) | Onda |
|---|---|---|---|---|
| `/admin/agentes` | servidor | sim | sim | 2 (admin) |
| `/admin/ajuda-publicacao` | servidor | não | não | 2 (admin) |
| `/admin/atendimento/[id]` | servidor | não | não | 2 (admin) |
| `/admin/atendimento` | servidor | não | não | 2 (admin) |
| `/admin/avaliacoes` | servidor | não | não | 2 (admin) |
| `/admin/avaliadores` | servidor | não | não | 2 (admin) |
| `/admin/candidaturas` | servidor | não | não | 2 (admin) |
| `/admin/cidades` | servidor | não | não | 2 (admin) |
| `/admin/conforto` | servidor | não | não | 2 (admin) |
| `/admin/contratos/[id]` | servidor | não | não | 2 (admin) |
| `/admin/contratos/encerramentos` | servidor | não | não | 2 (admin) |
| `/admin/contratos` | servidor | não | não | 2 (admin) |
| `/admin/dados-de-teste` | servidor | não | não | 2 (admin) |
| `/admin/destinos` | servidor | não | não | 2 (admin) |
| `/admin/documentos` | servidor | não | não | 2 (admin) |
| `/admin/emails-teste` | servidor | não | não | 2 (admin) |
| `/admin/eventos` | servidor | não | não | 2 (admin) |
| `/admin/financeiro` | servidor | não | não | 2 (admin) |
| `/admin/fotografos` | servidor | não | não | 2 (admin) |
| `/admin/fotos-perfil` | servidor | não | não | 2 (admin) |
| `/admin/funil` | servidor | não | não | 2 (admin) |
| `/admin/imoveis` | servidor | não | não | 2 (admin) |
| `/admin/marketing` | servidor | não | não | 2 (admin) |
| `/admin/moderacao/ofensas` | servidor | não | não | 2 (admin) |
| `/admin` | servidor | não | não | 2 (admin) |
| `/admin/parceiros` | servidor | não | não | 2 (admin) |
| `/admin/parceiros/pedidos/[id]` | servidor | não | não | 2 (admin) |
| `/admin/parceiros/pedidos` | servidor | não | não | 2 (admin) |
| `/admin/pedidos` | servidor | não | não | 2 (admin) |
| `/admin/pendencias` | servidor | não | não | 2 (admin) |
| `/admin/premissas` | servidor | não | não | 2 (admin) |
| `/admin/qualidade` | servidor | não | não | 2 (admin) |
| `/admin/retencao` | servidor | não | não | 2 (admin) |
| `/admin/servicos` | servidor | não | não | 2 (admin) |
| `/admin/sistema` | servidor | não | não | 2 (admin) |
| `/admin/socios` | servidor | não | não | 2 (admin) |
| `/admin/solicitacoes` | servidor | não | não | 2 (admin) |
| `/admin/usuarios` | servidor | não | não | 2 (admin) |
| `/dashboard/agenda` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/assinatura` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/avaliacao-imovel/[id]` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/avaliacoes` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/buscas` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/candidaturas` | servidor | não | sim | 4 (dados no cliente) |
| `/dashboard/carteira` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/comparar` | cliente | não | não | 4 (dados no cliente) |
| `/dashboard/conta/[secao]` | servidor | sim | sim | 1 (piloto — E789: Perfil) |
| `/dashboard/conta/avaliacoes` | servidor | não | não | 1 (piloto) |
| `/dashboard/conta/excluir` | servidor | sim | não | 1 (piloto) |
| `/dashboard/conta` | cliente | sim | não | 1 (piloto) |
| `/dashboard/conta/seguranca` | servidor | sim | sim | 4 (dados no cliente) |
| `/dashboard/contratos/[id]/ficha` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/contratos/[id]` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/contratos` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/estadia/[contratoId]/alteracao` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/estadia/[contratoId]/confirmada` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/estadia/[contratoId]/contrato` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/estadia/[contratoId]/convidado` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/estadia/[contratoId]/encerrar` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/estadia/[contratoId]/mensagens` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/estadia/[contratoId]/ocupantes` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/estadia/[contratoId]` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/favoritos` | cliente | sim | não | 4 (dados no cliente) |
| `/dashboard/fechamento` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/ferramentas` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/ganhos` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/garantias` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/imoveis/[id]/cartao` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/imoveis/[id]/conforto` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/imoveis/[id]/desempenho` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/imoveis/[id]/editar` | servidor | sim | sim | 4 (dados no cliente) |
| `/dashboard/imoveis/[id]/nivel` | servidor | não | sim | 4 (dados no cliente) |
| `/dashboard/imoveis/[id]/parceiros` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/imoveis/[id]/publicar` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/imoveis/novo` | cliente | sim | sim | 4 (dados no cliente) |
| `/dashboard/imoveis` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/indicacoes` | cliente | sim | sim | 4 (dados no cliente) |
| `/dashboard/leads/[id]` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/leads` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/locacoes/[id]` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/locacoes` | servidor | sim | não | 3 (painel, servidor) |
| `/dashboard/mensagens` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/notificacoes` | servidor | sim | não | 3 (painel, servidor) |
| `/dashboard/orcamentos/nova` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/orcamentos` | servidor | sim | não | 3 (painel, servidor) |
| `/dashboard` | servidor | sim | não | 1 (piloto) |
| `/dashboard/parceiro/avaliacao/[pedido]` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/parceiro/avaliacao` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/parceiro` | servidor | sim | não | 3 (painel, servidor) |
| `/dashboard/pedidos-cidade` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/pedidos` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/propostas/[id]` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/propostas` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/qa/emails` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/recibos` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/reembolsos` | cliente | não | não | 4 (dados no cliente) |
| `/dashboard/respostas-rapidas` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/roi-imovel` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/servicos` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/servicos/pedidos/[id]` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/simulador` | cliente | não | não | 4 (dados no cliente) |
| `/dashboard/solicitacoes` | cliente | sim | não | 4 (dados no cliente) |
| `/dashboard/tributacao` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/verificacao` | cliente | sim | sim | 4 (dados no cliente) |
| `/dashboard/viabilidade` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/visitas/[id]` | servidor | não | não | 3 (painel, servidor) |
| `/dashboard/visitas` | servidor | não | não | 3 (painel, servidor) |
| `/qualificar` | servidor | não | não | 3 (painel, servidor) |
