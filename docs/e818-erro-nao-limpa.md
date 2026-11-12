# E818: erro de validação nunca limpa o formulário

**Relato (Rogério, uso real em 12/11):** no cadastro de vistoriador (`/dashboard/parceiro/avaliacao`), o CNPJ foi recusado como inválido e o formulário voltou **em branco**.

**Regra do Daniel:**
1. Um erro de validação nunca limpa o formulário.
2. O campo com erro fica em vermelho, com a mensagem própria junto dele.
3. A página rola até o 1º campo com erro e põe o foco nele.

Vale para o cadastro de parceiro em todas as categorias e para os demais formulários longos.

## Causa

O `FormAcao` (`src/components/vistoria/form-acao.tsx`) enviava por `<form action={…}>`. No React 19, um `<form action>` com função **reinicia o formulário quando a ação termina, mesmo quando ela devolve erro**. Todos os campos não controlados voltam ao valor inicial, que é vazio.

Esse mesmo padrão aparecia em:
- `/admin/destinos`
- `/admin/cidades`
- envio de arquivo do pedido de serviço

## O que mudou

| Onde | Antes | Depois |
|---|---|---|
| `FormAcao` (credenciamento de vistoriador e as demais ações de vistoria) | `<form action>`: limpava tudo no erro; a mensagem geral ficava só no rodapé | Envio por `onSubmit` + `startTransition` (`useEnvioSemLimpar`); o formulário só é limpo no **sucesso**. A ação devolve `campos: [{campo, mensagem}]`. Cada campo apontado ganha `aria-invalid`, borda vermelha e a mensagem logo abaixo (`campo-erro-<nome>`). A página rola até o 1º campo e o foca. |
| `validarPedidoAvaliador` | só a lista `falta` | também `campos` (nome, documento, cidade, experienciaLink, aceiteConduta), cada um com a sua mensagem |
| Cadastro de parceiro (`seja-parceiro-form`, todas as categorias) | os campos já ficavam (estado controlado), mas o erro aparecia só no rodapé | `validarSolicitacao` (no navegador e no servidor) devolve `campo`. O campo fica em vermelho, com `aria-invalid` e a mensagem junto (`sp-erro-<campo>`), e recebe rolagem e foco. A mensagem do rodapé continua. |
| `/admin/destinos` e `/admin/cidades` | `<form action>` | `onSubmit`; limpa só no sucesso (`useLimparNoSucesso`) |
| Pedido de serviço: envio de arquivo | `<form action>`: o arquivo escolhido sumia no erro | `onSubmit` |

## Inventário dos outros formulários com `action=`

- `acesso-socios`, `avisos/desligar` e `alerta-busca/desligar`: formulários de servidor com um campo ou só um token escondido. Não perdem nada que a pessoa tenha digitado.
- `caixa-emails-qa` e `recebidas-lista`: formulários GET de busca ou filtro.
- Mensagem do pedido de serviço: o campo é controlado (`texto`) e só é limpo no sucesso.

## Provas

### Unitário

Comando: `node --test src/lib/vistoria/e818-erro-nao-limpa.test.ts`

Resultado: **7 pass / 0 fail**.

Cobre:
- os campos do vistoriador;
- o `campo` de cada erro do parceiro, com CNPJ inválido apontando `documento` em todas as categorias;
- nenhum `<form action>` nos formulários corrigidos;
- a marcação, a rolagem e o foco.

### E2E no lab

Spec: `tests/e2e/specs/t1612-e818-erro-nao-limpa.spec.ts`. Build de produção, conta nova, envio com o CNPJ inválido `11.111.111/1111-11`. Casos:
- vistoriador;
- parceiro em limpeza, fotografia, mudança, manutenção e outro serviço.

| | main (`origin/main`) | branch |
|---|---|---|
| t1612 | **6 failed**. No vistoriador, depois do envio aparecem "Falta: CNPJ válido." e **todos os campos vazios, com o aceite desmarcado**: é o sintoma do Rogério. Nenhum campo fica marcado. | **6 passed**. Os demais campos seguem preenchidos (inclusive o CNPJ digitado), o CNPJ fica com `aria-invalid`, borda vermelha e a mensagem junto, e tem o foco. |

## Asserções alteradas

O erro passou a carregar o campo, e o formulário passou a usar `falhar()`. O comportamento antigo segue verificado.

- `src/lib/parceiros/e362-conferencia-portfolio.test.ts`: o texto do retorno de fotografia agora inclui `campo: "portfolioUrl"`.
- `src/lib/parceiros/e651-recusa-documento.test.ts`: o retorno do CPF é `{ ok: false, erro: MSG_SO_CNPJ, campo: "documento" }`.
- `src/lib/parceiros/e731-rotulo-sessao.test.ts`: `return setErro(ERRO_SESSAO_NAO_CONFIRMADA)` passou a `return falhar(ERRO_SESSAO_NAO_CONFIRMADA)`.
