# E803: casca de proprietário na conta do "Lucas (morador)". Desenho de papel duplo, não vazamento

Foto da main: `27dbdf1`. Origem: D7 da prova de 12/11/2026, que veio marcada como não confirmada. Conferência só de leitura, no código e no banco de produção. Sem correção.

## O que a regra diz (código)

- **Conta única** (ordem 9f3085d8, `src/config/menu-por-papel.ts`): todo usuário é morador, e é proprietário quem **já anunciou um imóvel, em qualquer status** (`temImovel`). As seções do dono aparecem só para quem tem esse papel.
- **Modo do painel** (`resolveInitialMode`, `src/lib/data/mode-actions.ts`):
  - (a) a preferência salva (`preferred_mode`) vence sempre;
  - (b) se não houver, conta com `role` admin ou owner, **ou com ao menos um imóvel**, abre no modo dono;
  - (c) conta nova sem papel cai na pergunta de primeiro acesso.
- **Topo** (`dashboard-shell.tsx` → `papelDaBarra` → `TopoPainel`): no modo dono, o rótulo é "Áreas do proprietário" (Anúncios, Interessados, Contratos…).

## A conta da prova (produção, só leitura)

| Perfil | `role` | `preferred_mode` | Imóveis | `is_teste` |
|---|---|---|---|---|
| "Lucas" (conta de teste da prova) | tenant | **owner** | **1 rascunho** ("Rascunho de anúncio") | sim |

A conta já anunciou (tem um rascunho) e a última escolha salva é o modo dono. Pela regra, ela é **morador e proprietário ao mesmo tempo**, e o painel abre na casca do proprietário. Isso é o desenho do papel duplo, não vazamento de papel: nada de outra conta aparece, e as áreas são as do próprio rascunho dele.

## A frase "como os proprietários veem seu perfil"

É o subtítulo da tela Perfil (`SUBTITULO_PERFIL`, `perfil-tela.tsx`). Para quem é morador, a frase está **certa**: o perfil é o que o proprietário vê da candidatura antes do aceite (o espelho do E800). Não é texto de dono vazando para a conta de morador.

## Decisão

Fecha **sem correção**: é o desenho aprovado de papel duplo (conta única).

**Para a próxima prova:** quem quiser ver a casca **só de morador** precisa de uma conta sem nenhum anúncio, nem rascunho, e com `preferred_mode` tenant ou vazio. Também dá para usar o seletor de papel do painel para voltar ao modo morador.
