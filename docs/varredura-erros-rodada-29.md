# Varredura de erros — rodada 29 (06/11/2026)

Alvo: leituras de nome e selo "no padrão protegido". Resultado do exame, antes de mexer:

## O que já está certo (não mudou)
- **Selos só positivos** (`linkedinConectados`, `vinculosConfirmados`, `telefones_verificados` no cartão do candidato): a falha da leitura tira o selo, que equivale a "sem selo" — não afirmam nada falso. Fazê-los lançar derrubaria a lista Interessados por causa de um selo. Mantidos.
- **Identidade** no cartão do candidato: já tem o estado `IDENTIDADE_INDISPONIVEL` para a falha.
- **Celular** no bloco "Confiança" da Conta: sem resposta, cai em "Em breve".
- **Avaliações recebidas** (`conta/avaliacoes` e `dashboard/avaliacoes`): já chamam `avaliacoesRecebidas({ exigir: true })`.

## Achados
- **141 — e-mail na Conta** (`src/components/account/conta-blocos.tsx`): a falha da leitura do usuário (`getUser`) deixava "Confirme pelo link que enviamos" para quem já tinha confirmado. Agora fica neutro: "Não foi possível verificar agora".
- **142 — duas etapas na Conta** (mesmo arquivo): a falha da leitura dos fatores (`mfa.listFactors`) mostrava "Desativada" com o botão "Ativar" para quem já tinha a verificação ativa — falso negativo de segurança. Agora fica neutro e o botão vira "Abrir" (a tela de segurança mostra o estado verdadeiro).

Novo estado `"indisponivel"` no tipo `Situacao`; o renderizador já cobre qualquer situação que não seja `ok` nem `em_breve` com o círculo vazio e o texto do detalhe.

## Teste
`src/components/account/achado141-confianca-indisponivel.test.ts` (3 casos, escritos antes e vistos vermelhos).
