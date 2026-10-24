# PERFIL-B: dados das telas do perfil (Pista B)

Item 3 da ordem do Daniel de 23/10, às 21:03: os dados que as telas do perfil pedem e que ainda não existiam. As telas de referência são os mockups aprovados `docs/mockups/perfil-01..08`, na branch `mockups` (commit fe1259bf). Quem constrói as telas é a Pista A.

## Situação tela a tela

| Tela | Dado | Situação |
|---|---|---|
| `perfil-01-topo-espelho` | Nome, foto, cidade, papéis, "Na Viva desde", selos | Já existe (Conta → Perfil público, espelho do perfil, PAPEL-B) |
| `perfil-02-avaliacoes` | Avaliações recebidas: quem avaliou (nome curto e foto), nota, comentário, data, imóvel e cidade; abas Todas / Recentes / Positivas; busca; Responder | **Completado neste PR.** As avaliações e as respostas já existiam (0089, 0129). Faltavam quem avaliou, o imóvel, a cidade, as abas e a busca. Detalhes abaixo |
| `perfil-03-papeis-intencao` | Papéis e intenção | Já existe (49, PAPEL-B) |
| `perfil-04-dados` | Nome, e-mail, telefone, CPF/CNPJ | Já existe |
| `perfil-05-privacidade` | Privacidade e segurança | Já existe (seção Privacidade e segurança da Conta) |
| `perfil-06-notificacoes` | Preferências de aviso | Já existe |
| `perfil-07-pagamentos` | "Como você recebe (proprietário)": chave Pix com botão de copiar | **Criado neste PR: migração 0236.** A tela de Pagamentos dizia que esse dado "ainda não existe no cadastro" |
| `perfil-07-pagamentos` | "Para suas estadias (morador)": cartão `•••• 4242` e "Adicionar cartão" | **Não criado.** Ver divergência **Cartão** abaixo |
| `perfil-08-ajuda-sair` | Ajuda, sair, "Sair da Viva" | Já existe (51 F1) |

## O que este PR entrega

### Avaliações recebidas (`perfil-02-avaliacoes`)
- **Leitura:** `src/lib/data/avaliacoes-recebidas.ts` (`avaliacoesRecebidas()`).
  - As avaliações, as respostas e os pedidos de revisão vêm pela sessão. A RLS só deixa ler as avaliações publicadas.
  - O nome e a foto de quem avaliou vêm pelo cliente de serviço, como no perfil público. Sai só o nome curto ("Carlos M."), mais a foto do caminho canônico. A foto só aparece porque houve estadia entre as duas pessoas.
- **Regras puras:** `src/lib/conta/avaliacoes-recebidas.ts`.
  - `filtrarAvaliacoes`:
    - Recentes = publicadas nos últimos 90 dias;
    - Positivas = nota 4 ou 5;
    - a busca ignora acento e procura no comentário, no autor, no imóvel e na cidade.
  - `linhaContextoAvaliacao` monta a linha "Recebida em 12 out 2026 · Casa no Santa Mônica · Uberlândia".
  - `resumoAvaliacoes` dá média, quantidade e quantas ainda estão sem resposta.
- **Tela atual:** `/dashboard/avaliacoes` passou a mostrar quem avaliou, o imóvel e a cidade, com as abas e a busca (`?aba=&q=`). Responder e pedir revisão continuam iguais. A Pista A pode trocar o layout para o do mockup consumindo a mesma função.

### Recebimento por Pix (`perfil-07-pagamentos`)
- **Migração 0236** (`recebimento_pix`): uma linha por pessoa, com o tipo (CPF, CNPJ, e-mail, celular ou chave aleatória) e a chave.
  - A RLS só deixa o próprio dono ler, criar, mudar e apagar a linha.
  - Anon não tem acesso nenhum, e nenhuma outra conta lê.
  - O script `aplicar-0236.sql` é idempotente; o rollback está em `rollback/0236_rollback.sql`.
- **Regras puras:** `src/lib/conta/chave-pix.ts`.
  - `normalizarChavePix` valida CPF e CNPJ pelo dígito verificador, e-mail, celular com DDD (formato +55) e chave aleatória (EVP).
  - `mascararChavePix` mostra a chave como a tela exibe, por exemplo `***.982.247-**`.
- **Ações:** `src/lib/data/recebimento-actions.ts`, com `minhaChavePix`, `salvarChavePix` e `removerChavePix`, todas pela sessão.
- **Tela atual:** Conta → Pagamentos, para quem é proprietário, ganhou "Sua chave Pix para receber": salvar, mostrar mascarada, copiar, trocar e remover.
  - O texto "A Viva não recebe esse valor" continua.
  - O mockup mostra a chave inteira; aqui ela aparece mascarada, como o CPF em todas as telas. Ela sai inteira só no botão de copiar.

## Divergências do mockup com a regra do produto

Cada uma vem com uma sugestão.

- **Cartão do morador (`perfil-07`).** O valor mensal é pago **direto ao proprietário**; a Viva não recebe esse valor, como o mesmo mockup diz no bloco de cima. Não há cobrança recorrente em cartão pela Viva que justifique guardar um cartão.
  - Guardar cartão exigiria tokenização no provedor de pagamento (Asaas): o número nunca fica no nosso banco. Não há chave nem integração de tokenização configurada para isso, e não criei nenhuma.
  - Sugestão: tirar o bloco do cartão ou trocar pelo texto que já existe ("Você paga o valor mensal direto ao proprietário…").
  - Se o Daniel quiser cartão, para a caução pré-autorizada que já existe como forma de pagamento da caução, isso vira um prompt próprio. Esse prompt depende da chave do Asaas, que o Daniel cola.
- **Palavras (`perfil-02`).** O mockup diz "Avaliações que você recebeu de **anfitriões** e **inquilinos**". No produto é **proprietários e moradores**: a tela atual diz "proprietário" ou "morador" ao lado do nome. O botão grande "Responder avaliações" responde uma avaliação por vez; cada resposta é pública e única (0129).
- **Contrato.** A chave Pix ainda **não** entra sozinha no contrato. Hoje o contrato diz "nos dados que você informa no contrato". Ligar a chave ao contrato é mudança de contrato e fica para um prompt próprio. A tela não promete isso.
