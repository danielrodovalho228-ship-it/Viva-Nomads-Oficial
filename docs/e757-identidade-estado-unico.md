# E757: um estado só para a verificação de identidade

## Evidência

Phoenix RELATORIO-004 (C6/D1). As superfícies diziam coisas em tensão:
- `/como-funciona` dizia "A verificação de identidade chega em breve", e o painel repetia "em breve";
- o "Complete seu perfil" já pedia "Documento (CPF ou CNPJ)";
- em `/dashboard/parceiro/avaliacao`, "a verificação abre perto do lançamento" convivia com "Você pode mandar o pedido… agora";
- no passo 2 de `/parceiros` ("A Viva confere — Identidade e CNPJ"), uma conferência que ainda não abriu aparecia como etapa corrente.

## O estado único (até a Certta entrar)

> **A verificação automática de identidade ainda não abriu. Por ora, a equipe da Viva confere o documento.**

A fonte é `src/lib/identidade/texto-unico.ts`. Quando a Certta entrar, o texto muda ali e em `src/lib/identidade/estado.ts`. Isto é só consistência de texto e estado; não há decisão jurídica nova.

## O que mudou

Este PR **parte do #3574** (Pista A, em draft com conflito desde 09/11). Os commits dele foram trazidos para cá, o conflito foi resolvido nesta branch e o que faltava foi fechado.

| Superfície | Agora |
|---|---|
| `/como-funciona` e o anúncio de exemplo (`PASSOS_MORADOR`) | o estado único (#3574) |
| `/seguranca` (texto e FAQ) e `/para-proprietarios` | o estado único (#3574) |
| `/parceiros`, passo 2 | "A equipe da Viva confere o seu documento e o CNPJ (a verificação automática de identidade ainda não abriu); …". Mantém também o **prazo de resposta** (`TEXTO_PRAZO_PARCERIA`), que a main ganhou depois do #3574: este era o conflito |
| Fechamento, avaliação de imóveis (complemento do passo "Identidade verificada", sem "perto do lançamento") e mensagem da API CAF | o estado único (#3574) |
| `/dashboard/verificacao` (o painel que repetia "em breve") | **novo aqui:** "Disponível em breve, por meio de um parceiro." passou a ser a frase única |
| "Complete seu perfil", com o item "Documento (CPF ou CNPJ)" | sem mudança. Fica coerente com o estado único, porque hoje a equipe confere o documento |

## Provas

### Unitário

Comando:
```
node --test src/lib/conta/*.test.ts src/lib/e757-identidade-texto-unico.test.ts src/app/promessa-em-breve.test.ts src/lib/vistoria/*.test.ts src/lib/parceiros/*.test.ts src/lib/identidade/*.test.ts src/lib/textos-publicos.test.ts src/lib/e730-parceiros-promessa.test.ts src/lib/estilo/*.test.ts
```
Resultado: **611 pass / 0 fail**. O `e757-identidade-texto-unico.test.ts` tem 5 casos. Os 2 novos cobrem o painel e o passo 2 com o prazo.

### E2E

`tests/e2e/specs/t1616-e757-identidade-estado-unico.spec.ts` lê o texto renderizado de `/como-funciona`, `/parceiros`, `/seguranca` e `/para-proprietarios` (páginas públicas, sem conta). Resultado no lab (main × branch): ver o PR.

## Asserções alteradas

- **`src/lib/conta/leva2-e68-e71.test.ts`** (E68): conferia que "em breve" aparecia **uma vez** em `/dashboard/verificacao`, com o texto antigo. Agora confere zero "em breve" e a frase única `{IDENTIDADE_ESTADO_FRASE}` exatamente uma vez. A intenção do E68 (o aviso não se repete) continua valendo.
- **As asserções que o #3574 já trazia:** `e362`, `e649`, `e727-e728`, `promessa-em-breve` e `telas-exibicao`.

## Dúvidas

As mesmas do #3574: `/termos` e `/privacidade` são texto jurídico e **não foram tocados**. Os títulos "(em breve)" das seções 4 dos termos e 7 da privacidade ficam para revisão jurídica.
