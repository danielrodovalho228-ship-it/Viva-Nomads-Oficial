# Contribuindo — regras permanentes

Regras de arquitetura e produto que **não** podem ser quebradas por trabalho novo.
Elas nascem da regra de ouro do negócio e da integridade da área logada.

## Regra de ouro (modelo de negócio)

A plataforma **conecta, verifica, documenta e registra — NUNCA movimenta dinheiro.**
Todo o vocabulário do produto tem que sustentar isso.

- **Vocabulário proibido na UI** (em contexto de aluguel/caução): `carteira`, `saldo`,
  `repasse`, e qualquer termo que sugira que a plataforma retém/movimenta valores.
- Todo serviço é **"via parceiro"** com status honesto. Enquanto a parceria não estiver
  assinada, o card fica **sem CTA ativo**, com status "em estruturação — via parceiro".

## Integridade da casca do dashboard

1. **Toda rota nova do dashboard nasce dentro do route group `src/app/(dashboard)/`.**
   Esse grupo aplica `AuthGuard` + `DashboardShell` (menu lateral + barra do topo).
   Nunca crie uma tela de área logada fora dele (o sintoma é a página abrir "solta",
   sem menu — foi o bug de `Pedidos de moradia`).
2. **Todo item de menu aponta para uma rota interna** (`/dashboard/*`, `/qualificar`,
   `/admin*`) e renderiza dentro da casca. Nunca aponte um item de menu para uma rota
   do grupo `(public)`.
3. **Item de menu sem página pronta usa o placeholder padrão** `<EmConstrucao/>`
   (`src/components/dashboard/primitives.tsx`) — nunca 404, nunca página em branco,
   nunca rota pública.
4. **O menu do proprietário tem no máximo 9 itens.** Funcionalidade nova entra como
   **card do hub Ferramentas** (`/dashboard/ferramentas`) ou como **seção de uma
   página existente** — não como novo item de menu, salvo decisão explícita de produto.
   Menu atual: Visão geral · Meus imóveis · Pedidos de moradia · Mensagens · Fechamento ·
   Contratos & blocos · Ferramentas · Assinatura · Conta. Grupo Admin só para `role=admin`.
5. **Papel:** nenhum link de contexto de um papel aponta para página do outro papel.
   Área de admin só existe no DOM para `role=admin` (não é hide por CSS) e tem guard
   de papel no cliente **e** no proxy.

## Remover da UI ≠ apagar

Remover um item do menu (ou esconder atrás de flag) **não** apaga a rota, a página, a
tabela nem a coluna. O que sai da navegação continua vivo no código (rota sem link ou
atrás de flag `NEXT_PUBLIC_<FLAG>`), até decisão explícita de remoção de dados.

## Verificação automática

O e2e `e2e/qa-full.mjs` verifica que **nenhum item de menu renderiza fora da casca**
(todos têm a sidebar). Rode-o antes de mexer no menu ou em rotas do dashboard.
