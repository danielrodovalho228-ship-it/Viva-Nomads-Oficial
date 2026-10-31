# Prova ao vivo do E289, grupo 2: os e-mails da avaliação de imóvel

Autorizada pelo Muse em 31/10, com contas e dados de **teste**, a chave `VISTORIA_ATIVA` **desligada** e sem tocar em
dado real. A massa é a migração `0271_qa_massa_vistoria_e289`. A Action aplica a migração quando o PR é mesclado.

## O que a massa cria
Uma visita de avaliação **agendada para o dia seguinte ao da aplicação**, às 10:00 de Brasília. Se a aplicação
acontecer depois das 21:00 de Brasília, a visita vai para o dia depois de amanhã. Os dados:

| Campo | Valor |
|---|---|
| Anúncio | `[TESTE QA NÍVEL] Essencial` (pausado, fora da busca), do `proprietario1@` (Daniel) |
| Avaliador | o de teste UDI-002 (`avaliador1@`) |
| Moradora | `cadastro1@` (Fernanda). O imóvel está ocupado e a concordância já foi dada |
| Pedido | id `a0271000-0000-4000-8000-000000000001`, com `teste = true` |

## Quando sai
O banco roda a rotina da avaliação de hora em hora (0215), e essa rotina não depende da chave. Na primeira rodada da
**véspera** da visita, ela manda o `vistoria_lembrete` para as três partes. A coluna `lembrete_d1_em` impede que o
lembrete saia de novo. Os e-mails caem na caixa de teste (Admin → Dados de teste → E-mails).

## O que conferir: 3 e-mails `vistoria_lembrete`
| Para | Assunto | Corpo |
|---|---|---|
| Daniel (dono) | "Visita de avaliação amanhã às 10:00: [TESTE QA NÍVEL] E…" (o título vem encurtado pela régua de 70) | "Olá Daniel, a visita de avaliação de [TESTE QA NÍVEL] Essencial é amanhã, DD/MM/AAAA às 10:00 (horário de Brasília)…" |
| Avaliador (UDI-002) | o mesmo | a mesma frase, com o nome do avaliador na saudação |
| Fernanda (moradora) | o mesmo | a mesma frase, com "Olá Fernanda" |

O bloco de dados traz "Imóvel: [TESTE QA NÍVEL] Essencial · Uberlândia" e "Visita: DD/MM/AAAA às 10:00 (horário de Brasília)". Nenhum dos três diz "o imóvel" sem o nome, e nenhum sai sem
a data e a hora.

Os e-mails de agendada, concordância e ausência só nascem de ações na tela, que ficam atrás da chave desligada. O
corpo deles está coberto pelos testes de `src/lib/vistoria/corpo-email.test.ts` e pela spec de laboratório t728.

## Consulta de conferência (só leitura)
```sql
select evento, destinatario_mascarado, assunto, left(corpo, 400) corpo, criado_em
  from emails_teste
 where evento = 'vistoria_lembrete' and criado_em > now() - interval '2 days'
 order by criado_em;
select id, status, agendado_para, lembrete_d1_em from vistoria_pedidos where id = 'a0271000-0000-4000-8000-000000000001';
```

## Depois da prova
Para desfazer, use `supabase/producao/rollback/0271_rollback.sql`. Ele tira a visita de teste pelo id; o anúncio fica
pausado, como estava.
