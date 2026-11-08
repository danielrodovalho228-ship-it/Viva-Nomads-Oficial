# E690 — Etapa 5 de um avaliador de teste (auditoria E683, P7)

Levantamento em produção (só leitura, 07/11/2026). **Nenhuma migração, nenhum código.**

## O que já está pronto no dado
- **UDI-002** (`avaliador1@`, conta `is_teste`): credenciamento `em_teste`.
- O **registro da avaliação de teste já existe**: pedido `a0256000-…-0a1`, `teste = true`, `laudo_emitido`, avaliador UDI-002 (massa da 0256). É exatamente o que `comTesteConcluido` (`servidor.ts`) lê para liberar a ativação.
- A **identidade** não bloqueia: conta `is_teste` conta como confirmada (`estadoIdentidade`).
- Existe também um pedido `designado` parado (`…0a2`), de propósito (0256).

## O que falta (e não é dado)
O passo 5 do checklist só aparece cumprido com `testeConcluido` **e** status `ativo`/`suspenso` (`passosCumpridos`, `telas-exibicao.ts`). O UDI-002 está `em_teste`, e a transição `em_teste → ativo` é **só do admin com duas etapas (AAL2)** pela tela `/admin/avaliadores` (`adminDecidirCredenciamento`, `transicaoCredenciamento`). É a mesma ação do passo "ativar avaliador" da fila de QA: depende do admin observador com o código do app autenticador.

## Por que não forço por SQL
Uma migração que escrevesse `status = 'ativo'` ignoraria a aprovação humana em duas etapas e repetiria o defeito que o E30 fechou ("a massa de teste chegou a Ativo sem avaliação nenhuma"). Também iria contra a regra da casa: massa só pelas ferramentas de admin, nunca SQL avulso.

## Roteiro para quem tem a trava
1. Admin observador entra em `/admin/avaliadores`, abre UDI-002 (cidade Uberlândia) e **ativa**. A tela deve liberar a ação sem pedir nova avaliação de teste.
2. Conferir em `/dashboard/parceiro/avaliacao` (conta `avaliador1@`) que o passo 5 ("Avaliação de teste revisada pela Viva") aparece cumprido.
3. Com o UDI-002 ativo, o E682 (escolha → proposta → laudo) tem avaliador para o dono escolher em anúncio de teste.

## Dúvidas
1. Se o Daniel preferir que a massa já chegue ativa (sem passar pelo admin), é uma migração de 3 linhas na `avaliadores_credenciamento` (`status='ativo'`, `ativado_em`, `decidido_em`), só para `numero_credenciado = 'UDI-002'` com conta `is_teste`. Fica **aguardando decisão**; segui a leitura conservadora.
2. UDI-001 está `suspenso` (reativação também é ação de admin AAL2).

## Conferência rápida (só leitura, antes e depois de ativar)
Para o QA confirmar o estado do UDI-002 sem mexer em nada (consulta de leitura, nunca escrita):

```sql
select a.numero_credenciado, a.status, a.ativado_em,
       (select count(*) from vistoria_pedidos v
         where v.avaliador_id = a.id and v.teste and v.status = 'laudo_emitido') as avaliacoes_de_teste_concluidas
  from avaliadores_credenciamento a
 where a.numero_credenciado = 'UDI-002';
```

- **Antes:** `status = em_teste`, `ativado_em` vazio, `avaliacoes_de_teste_concluidas >= 1`.
- **Depois da ativação pelo admin:** `status = ativo` e `ativado_em` preenchido; a tela `/dashboard/parceiro/avaliacao` passa a mostrar o passo 5 cumprido.
- Se `avaliacoes_de_teste_concluidas = 0`, a massa da 0256 não está na base e o passo 5 não fecha mesmo com o avaliador ativo.
