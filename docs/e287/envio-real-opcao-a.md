# E287 — envio real às duas pioneiras (Opção A): caminho mínimo de servidor

Liberado por escrito em 07/11/2026 (Opção A, aprovada pelo Daniel às 07:45 CST; Gmail pessoal do Daniel proibido para este envio).

## O que foi criado (nenhuma tela, nenhuma funcionalidade visível ao usuário)
- `src/lib/notifications/pioneiras-e287-real.ts`: a regra, com dependências injetadas (testável sem Resend).
- `src/app/api/admin/pioneiras-e287/route.ts`: `POST` só para admin, corpo `{ "pessoa": "maria-de-fatima" | "lya-raquel" }`.
- Textos e HTML: os já montados no `layoutEmail` (`pioneiras-e287.ts`, PR #3228), idênticos aos textos aprovados. Assunto exato `Você foi uma das primeiras 💚 — novidades da Viva Nomads`.

## Garantias (cobertas por `pioneiras-e287-real.test.ts`)
- Só as duas pessoas (ids fixos: `693e53ed-…` Maria de Fátima/owner, `47ca91e1-…` Lya Raquel/tenant); o destino nunca vem do pedido.
- Confere na hora: id + e-mail + papel + `is_teste` não verdadeiro, e a marca `boas_vindas:<id>` existe (só leitura; marcas não são regravadas nem alteradas).
- Ordem obrigatória: a Lya só depois do envio aceito da Maria de Fátima.
- Um envio por pessoa: reserva `pioneiras_e287_envio:<pessoa>` em `automacoes_envios` antes de enviar; se o serviço recusar ou não estiver configurado, a reserva é liberada e nada conta como enviado.
- `interno: true` (sem o sufixo " · Viva Nomads" do `comMarca`), remetente `Viva Nomads Brasil <suporte@vivanomads.com.br>`, reply-to `suporte@vivanomads.com.br`, sem `usuarioId` (nada na caixa de teste).
- `AUTOMACOES_ATIVO` não é lido nem alterado.

## Como disparar (depois do merge e do deploy), na ordem
1. Entrar como admin em vivanomads.com.br e, na mesma sessão do navegador, enviar `POST /api/admin/pioneiras-e287` com `{"pessoa":"maria-de-fatima"}` (mesma origem; o cookie de sessão autentica). A resposta traz `resendId` e `em`.
2. Conferir o `resendId` no painel do Resend (status entregue/aceito).
3. Só então `{"pessoa":"lya-raquel"}`; conferir o segundo id.
Se o primeiro não for aceito, não enviar o segundo.
