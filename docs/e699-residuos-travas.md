# E699 — resíduos das travas de publicação

O cartão "Para publicar, a Viva pede duas coisas" (identidade + documento do imóvel) já existia no Passo 1. Fechado aqui:

| Resíduo | O que mudou |
|---|---|
| (a) `/dashboard/imoveis` só mostrava o documento | "Falta para publicar" ganha "Confirmação de identidade" (link), usando a mesma leitura do cadastro (`/api/caf/status`). Carregando ou indisponível não afirma "falta". |
| (b) Entrada do fluxo (Qualificação e resultado) sem o cartão | `Qualificacao` ganha a prop `travas`; a página passa o mesmo `TravasDePublicacao`. |
| (c) Identidade sem caminho no cartão | Link "Resolver": CPF ausente → `/dashboard/conta/dados#documento`; senão → `/dashboard/verificacao`. |
| (d) Segurança "confirmada" × cartão "pendente" | Causa provável: a leitura de `/api/caf/status` não voltava (rede/401/5xx) e o cartão ficava "carregando" para sempre, que lia como pendência. Agora o hook diz `indisponivel` e o cartão mostra "não deu para conferir agora" + "Ver em Segurança"; enquanto confere, "conferindo…". A resposta do servidor sempre vence. |

Testes: `src/lib/anuncio/travas-publicacao.test.ts` (5 casos novos, vistos vermelhos antes). Módulos `anuncio`, `identidade`, `estilo` verdes; `tsc` limpo. Sem prova ao vivo.

## Dúvidas
1. (d) não consegui reproduzir a divergência sem a conta do QA: pelo código, `/api/caf/status` e a página de Segurança usam o mesmo `estadoIdentidadeDe`. Se a prova ao vivo ainda mostrar "pendente" com a leitura OK, o defeito está em outro ponto e preciso do print (e-mail da conta e hora).
2. No painel, o cartão de um anúncio "100% · Pronto para publicar" pode mostrar também a identidade pendente (a prontidão do anúncio não conta identidade; é decisão do servidor ao publicar).
