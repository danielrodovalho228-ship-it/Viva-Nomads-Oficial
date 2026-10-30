# Ficha de execução — disparo ao vivo E204 · E205 · E206 · lembrete de início de bloco

Uma página para o circuito do Muse. O detalhe de cada gatilho está em `docs/qa-disparos-e204-e206.md` (roteiro),
`docs/qa-disparo-lembrete-bloco.md` (lembrete, massa 0260) e `docs/qa-prova-e204.md` (asserções do E204). Aqui fica só o
que executar, o que conferir antes e depois, e o que cada e-mail tem que trazer.

**Nada disto foi disparado pela Pista B.** Todas as contas são de teste: cada e-mail cai em `emails_teste` (Conta → Caixa
de e-mails de teste), e o envio real também sai. Entrada sempre pela porta de QA (`/qa/entrar`).

Não tocar: a seed do D-5 (contrato `d5d50247…`, Premium `330ebf37`, parceiro "[TESTE QA] Limpeza D-5" e o pedido dele),
a chave `AUTOMACOES_ATIVO`, o 2FA, `is_admin()` e `ADMIN_2FA_OBRIGATORIA`.

## A consulta única (antes e depois de cada gatilho)

Rodar antes do gatilho (anotar a contagem) e depois (a contagem sobe exatamente no número da coluna "e-mails"):

```sql
select p.email, e.evento, e.assunto, e.criado_em
  from emails_teste e join profiles p on p.id = e.usuario_id
 where p.email in ('proprietario1@vivanomads.com.br', 'proprietario2@vivanomads.com.br',
                   'inquilino1@vivanomads.com.br', 'inquilino2@vivanomads.com.br',
                   'cadastro1@vivanomads.com.br', 'teste-qa-2026@mail-teste.com.br', 'proprietario-qa@mail-teste.com.br')
   and e.criado_em > now() - interval '2 hours'
 order by e.criado_em desc;
```

Regra geral para todo e-mail: chega em segundos; um por destinatário; nenhum e-mail do evento para quem não está na
coluna "Quem recebe".

## Ordem de execução

| # | Item | Quem age · onde | O que fazer | Evento | Quem recebe (e-mails) | O e-mail tem que trazer |
|---|---|---|---|---|---|---|
| 1 | E204 | proprietario1 · `/parceiros/paulo-fotos-teste-qa` | Solicitar orçamento → Fotografia, imóvel "[TESTE QA] Prova de publicação", descrição ≥ 10 letras, 1 horário futuro | `parceiro_pedido_novo` | proprietario2 (1) | "Novo pedido de orçamento"; Serviço; Imóvel "título · bairro, cidade"; Data sugerida "dd/mm/aaaa às hh:mm"; Pedido (código); botão para `/dashboard/servicos/pedidos/<id>`. **Sem** Valor e sem "Você recebe" |
| 2 | E204 | proprietario2 · o pedido do item 1 | Enviar orçamento de R$ 350 | `parceiro_orcamento_recebido` | proprietario1 (1) | "…o orçamento de … : R$ 350"; Valor R$ 350; Imóvel; Pedido. **Nunca** "Você recebe" |
| 3 | E204 | proprietario1 · o mesmo pedido | Aceitar | `parceiro_orcamento_aceito` | proprietario2 (1) | "(R$ 350)"; Valor R$ 350; **Você recebe R$ 315**; Pedido |
| 4a | E205 | teste-qa-2026@ · 1º acesso | Escolher a intenção (morador) e enviar | `boas_vindas` | a própria conta (1) | "Boas-vindas ao Viva Nomads", versão morador. Chave `boas_vindas:<id>` em `automacoes_envios` |
| 4b | E205 | proprietario-qa@ · 1º acesso | Escolher a intenção (proprietário) | `boas_vindas` | a própria conta (1) | versão proprietário. Repetir a entrada **não** gera um 2º |
| 5 | E205 | proprietario1 → inquilino1 · Interessados do lead `61729f0b` (Lucas) | Enviar proposta; o Lucas aceita em `/dashboard/propostas/<id>` | `proposta_recebida` e depois `proposta_aceita` | inquilino1 (1 recebida); depois os dois (1 cada) | dono: "Proposta aceita: {nome} quer morar…", com a taxa congelada; morador: "Você garantiu o seu próximo lar", com a linha do tempo. **Não seguir para o Fechamento** |
| 6 | E205 | proprietario1 → inquilino2 · lead `f2c00f6a` (Ana) | Enviar proposta; a Ana recusa com um motivo | `proposta_recusada` | os dois (1 cada) | "{Primeiro nome} recusou a proposta" com o motivo; dono "Ajustar e enviar nova versão"; morador "Ver outros imóveis parecidos" |
| 7 | E205 | inquilino1 e proprietario1 · `/imoveis/a0259000-0000-4000-8000-000000000001` | Pedir visita nova; o dono confirma; um dos dois cancela | `visita_cancelada` | os dois (1 cada) | quem cancelou, motivo, horário; morador "Pedir outro horário" |
| 8 | E205 | inquilino1 e proprietario1 · mesmo anúncio | Pedir visita **com horário daqui a menos de 24 h**; o dono confirma | `visita_vespera` | os dois (1 cada), logo após a confirmação | horário de Brasília; presencial: endereço só para o morador; vídeo: o link |
| 9 | E205 | inquilino1 · mesmo anúncio | Pedir visita com horários em +1 h e +2 h; **ninguém confirma** | `visita_expirada` | os dois (1 cada), depois do último horário (ao abrir Visitas ou no cron) | Imóvel e "Horários propostos"; o pedido fica "cancelado", motivo "expirou" |
| 10 | Lembrete + E206 | proprietario1 · `/dashboard/estadia/a0260000-0000-4000-8000-000000000001/alteracao?renovar=1` | Prazo total de 1 para 2 meses → enviar | `estadia_aditivo_proposto` | cadastro1 (1) | (não é o lembrete) |
| 11 | Lembrete + E206 | cadastro1 · a mesma estadia | Aceitar o aditivo | `estadia_aditivo_respondido` | proprietario1 (1) | — |
| 12 | E206 | proprietario1 e cadastro1 · a mesma estadia | Cada um toca "Assinar" | `contract_signature_code` | quem pediu (1 cada) | "Seu código para assinar o contrato"; imóvel "[TESTE QA] Carteira 2" e "(aditivo 1)"; "vale por 15 minutos e só funciona uma vez"; linha antifraude ("Nunca passe este código a ninguém…") |
| 13 | Lembrete | os dois digitam o código | Na **2ª** assinatura o aditivo é aplicado e o bloco 2 nasce em D+3 | `bloco_inicio_lembrete` | **só** cadastro1 (1) | "O bloco 2 da sua estadia começa em dd/mm"; Imóvel; Datas do bloco; Valor do bloco; "O pagamento é direto ao proprietário…"; botão "Ver a estadia". **Sem** "vence", "vencimento", "atraso", dado bancário ou cobrança. Chave `bloco_inicio_lembrete:a0260000-…:2` |
| 14 | E206 | inquilino1 · Conta → Vínculo profissional | Informar um e-mail **da equipe** (`…@vivanomads.com.br`) | `vinculo_codigo` | caixa de teste do inquilino1 (1); o envio real vai ao endereço digitado | "Seu código do vínculo profissional"; validade; antifraude. Gmail/Hotmail são recusados de propósito |

Código de 2FA ("refazer") e Reautenticação **ficam fora do ao vivo** (motivo no roteiro, item 13).

## Prazos que valem

- **Item 13 (lembrete):** só até **01/11/2026** (D+2 da 0260, aplicada em 30/10). Depois disso, a massa vence: rollback
  `supabase/producao/rollback/0260_rollback.sql` e nova aplicação.
- **Item 8:** o horário pedido precisa estar a menos de 24 h no momento da confirmação.
- **Item 9:** o e-mail só sai depois do último horário proposto.

## Depois (conferir que não sobrou nada fora de hora)

- Repetir a consulta única na manhã seguinte (o cron das 10h de Brasília roda): nenhuma linha nova de
  `bloco_inicio_lembrete`, `boas_vindas` ou `visita_vespera` para os mesmos itens.
- `select chave from automacoes_envios where chave like 'bloco_inicio_lembrete:a0260000-%';` → 1 linha.
