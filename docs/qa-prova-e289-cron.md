# Prova ao vivo do E289, grupo 1: os 5 e-mails do cron de automações

A massa é a migração `0268_qa_massa_automacoes_e289`. Ao mesclar, a Action aplica a migração. Os avisos saem na
**próxima rodada do cron diário** (`/api/cron/automacoes`, 13:00 UTC, ou seja, 10:00 em Brasília). Chamamos esse dia
de **ALVO**: é o dia da aplicação, se ela acontecer antes das 09:30 de Brasília; senão, o dia seguinte.

Tudo é de contas de teste: o dono é `proprietario1@` e a moradora é `cadastro1@` (Fernanda). Os e-mails caem na caixa
de teste (`emails_teste`; no painel, Admin → Dados de teste → E-mails).

O cron só envia de verdade com `AUTOMACOES_ATIVO=1`. A massa não mexe nessa chave. Para conferir antes, sem enviar
nada, rode a rota com `?simular=1`: a contagem de cada tipo deve subir.

## O que a massa cria
| Anúncio de teste (pausado) | Caso | Dispara no dia ALVO |
|---|---|---|
| `[TESTE QA] Automações E289 S` | contrato com saída em ALVO+3 | `saida_lembrete` → dono e moradora |
| `[TESTE QA] Automações E289 A` | contrato que terminou em ALVO-1 | `avaliacao_pedido` → dono e moradora |
| `[TESTE QA] Automações E289 A` | contrato com entrada em ALVO+10, sem instruções de chegada | `estadia_instrucoes_pendentes` → dono |
| `[TESTE QA] Automações E289 R` | contrato com o bloco terminando em ALVO+15 | `renovacao_aviso` → dono e moradora |
| `[TESTE QA] Automações E289 R` | proposta da moradora (ORC-AAAA-NNNN) vencendo em ALVO às 22:00 | `proposta_vencendo` → dono |

Os 3 anúncios têm o bairro "Santa Mônica" e a cidade "Uberlândia". O horário do imóvel é saída até as 11:00 e
entrada a partir das 14:00.

## O que conferir em cada e-mail
São 8 e-mails no total. Em todos, a saudação traz o primeiro nome (Daniel ou Fernanda). O texto não fala em
"comissão" nem "aluguel".

| Evento | Assunto esperado | Corpo deve trazer | Bloco de dados |
|---|---|---|---|
| `saida_lembrete` | "Saída de [TESTE QA] Automações E289 S em DD/MM" (DD/MM = ALVO+3) | o imóvel, a data com o ano e "(até as 11:00)" | Imóvel · Saída "DD/MM/AAAA, até as 11:00" |
| `avaliacao_pedido` | "Como foi a estadia em [TESTE QA] Automações E289 A?" | o imóvel e "terminou em DD/MM/AAAA" (ALVO-1) | Imóvel · Saída |
| `renovacao_aviso` | "Renovar [TESTE QA] Automações E289 R? O período termina em DD/MM" (ALVO+15) | o imóvel e o fim do período com o ano | Imóvel · Fim do período |
| `proposta_vencendo` | "Proposta de [TESTE QA] Automações E289 R vence em DD/MM às 22:00" (ALVO) | o número ORC-AAAA-NNNN, o imóvel e o prazo "(horário de Brasília)" | Imóvel · Proposta · Vence em |
| `estadia_instrucoes_pendentes` | "Instruções de chegada: [TESTE QA] Automações E289 A, entrada DD/MM" (ALVO+10) | o imóvel, a data da entrada e "o morador as recebe em DD/MM/AAAA" (ALVO+3) | Imóvel · Entrada do morador "…, a partir das 14:00" · O morador recebe as instruções em |

O título de teste é longo, então o assunto pode vir encurtado com "…". A régua corta o título para o assunto caber
em 70 caracteres, e isso é esperado.

## Consulta de conferência (só leitura)
```sql
select evento, destinatario_mascarado, assunto, left(corpo, 400) corpo, criado_em
  from emails_teste
 where evento in ('saida_lembrete','avaliacao_pedido','renovacao_aviso','proposta_vencendo','estadia_instrucoes_pendentes')
   and criado_em > now() - interval '1 day'
 order by evento, criado_em;
```

## Depois da prova
Para desfazer a massa, use `supabase/producao/rollback/0268_rollback.sql`. Ele tira os anúncios, os contratos, a
proposta e as chaves de envio da massa.
