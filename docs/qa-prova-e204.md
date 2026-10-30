# Prova do disparo do E204 — marco, janela e asserções (ao vivo e no laboratório)

Mesmos três gatilhos do roteiro `docs/qa-disparos-e204-e206.md` (itens 1 a 3). A spec **`t688-e204-prova-disparo`**
prova isso no laboratório. Este documento traz as mesmas asserções em forma de consulta, para o Muse conferir na caixa de
teste durante o disparo ao vivo.

**Massa ao vivo (conferida em produção em 30/10, só leitura):**
- Dono: **proprietario1**.
- Parceiro: "Paulo Fotos — TESTE QA" (`paulo-fotos-teste-qa`, conta **proprietario2**), publicado em fotografia, sem agenda: qualquer horário futuro vale.
- O proprietario1 não tem nenhum orçamento manual de fotografia aberto (o teto é 3).
- Imóvel: "[TESTE QA] Prova de publicação" (`a0259000-0000-4000-8000-000000000001`, ativo).

## Regra de leitura
Para cada item:
- anote a **hora do marco**, isto é, o momento do clique;
- confira que chegou **exatamente 1** e-mail do evento, **para quem deve**;
- confira que ele foi criado **em até 30 s depois do marco**, e não antes.

```sql
-- troque :evento e :marco (ISO, a hora do clique menos 2 s de folga)
select p.email, e.assunto, e.criado_em, e.corpo
  from emails_teste e join profiles p on p.id = e.usuario_id
 where e.evento = :evento
   and p.email in ('proprietario1@vivanomads.com.br', 'proprietario2@vivanomads.com.br')
   and e.criado_em >= :marco
 order by e.criado_em;
```

## 1. Pedido novo (`parceiro_pedido_novo`)
- **Marco:** o proprietario1, em `/parceiros/paulo-fotos-teste-qa`, toca em "Solicitar orçamento". Escolhe o imóvel "[TESTE QA] Prova de publicação", escreve a descrição (10+ caracteres), põe 1 horário futuro e envia.
- **Destinatário:** só o **proprietario2**. O proprietario1 não recebe nada deste evento.
- **Assunto:** "Novo pedido de orçamento".
- **Corpo:**
  - "você recebeu um pedido de orçamento de ensaio fotográfico do imóvel — teste qa para [TESTE QA] Prova de publicação";
  - quadro com `Serviço:`, `Imóvel: [TESTE QA] Prova de publicação · <bairro>, Uberlândia`, `Data sugerida: dd/mm/aaaa às hh:mm` e `Pedido: VN-SV-…`;
  - link `/dashboard/servicos/pedidos/<id>`.
- **Não pode aparecer:** `Valor:`, `Você recebe:`, o endereço exato nem "mensagens da plataforma".

## 2. Orçamento recebido (`parceiro_orcamento_recebido`)
- **Marco:** o proprietario2 abre o pedido, põe o valor (ex.: 350) e envia o orçamento.
- **Destinatário:** só o **proprietario1**.
- **Assunto:** "Você recebeu um orçamento".
- **Corpo:**
  - "o parceiro enviou o orçamento de … para [TESTE QA] Prova de publicação: R$ 350";
  - `Valor: R$ 350`, `Imóvel:`, `Pedido:`.
- **Não pode aparecer:** `Você recebe:`. O dono nunca vê o líquido do parceiro.

## 3. Orçamento aceito (`parceiro_orcamento_aceito`)
- **Marco:** o proprietario1 aceita o orçamento no pedido.
- **Destinatário:** só o **proprietario2**.
- **Assunto:** "Seu orçamento foi aceito".
- **Corpo:**
  - "O cliente aceitou o seu orçamento de … (R$ 350)";
  - `Valor: R$ 350`, **`Você recebe: R$ 315`** (os 10% da Viva fora), `Pedido:`.

## Fechamento
- **3 e-mails no total**, um por evento.
- **Nenhum** e-mail desses eventos antes do 1º marco.
- **Nenhum repetido.**
