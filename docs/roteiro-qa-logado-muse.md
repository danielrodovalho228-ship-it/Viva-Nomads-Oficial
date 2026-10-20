# Roteiro de QA logado (Muse) — do cadastro à assinatura, dos dois lados

Ordem ee7d27b8 (faixa D), item 5. Contas de teste (`profiles.is_teste`, migração 0135):
`inquilino1@vivanomads.com.br` (inquilino) e `proprietario1@vivanomads.com.br` (proprietário, 5 imóveis).
**Senhas: só o Daniel entrega ao Muse.** Nenhum agente lida com senha.

## O que a conta de teste NÃO faz (já na main, PR #736)
Decidido só no servidor (`src/lib/contas-de-teste.ts`); o navegador não informa "sou teste".

| Efeito externo | Comportamento para `is_teste` | Onde ver |
|---|---|---|
| Cobrança da comissão (Asaas, `/api/comissao`) | Não é criada; fica registrada como simulada, rótulo **TESTE** | `contas-de-teste-efeito.test.ts` |
| Contrato (ZapSign, `/api/contrato`) | Simulado; documento com a marca "MINUTA DE TESTE — sem validade" | `src/lib/contrato-etapas.ts` |
| Verificação de identidade (`/api/caf/verify`) | Laudo simulado "TESTE — verificação simulada" | `laudoSimuladoTeste()` |
| E-mail externo | Vai para a caixa de testes, não para o endereço da pessoa | `caixa-teste-servidor.ts` |
| Conta real sem chave da Certta | Mensagem "A verificação de identidade abre em breve…", sem travar o resto | `MSG_VERIFICACAO_EM_BREVE` |

O código de assinatura de 6 dígitos chega por e-mail: a conta de teste lê **os próprios e-mails** em
`/dashboard/conta` → "Caixa de e-mails de teste" (rota `/api/conta/caixa-teste`; nunca os de outra pessoa).

## Pré-condições (conferir ANTES do Muse começar)
1. Imóvel do proprietario1 a ser usado: publicado, **documento aprovado** e **pacote de limpeza pago** (para o QA do #693).
2. Um segundo imóvel publicado **sem** pacote (contraste).
3. Estado conferido em produção, só leitura, em 17/10: ver "Pendências" no fim.

## Lado do inquilino (inquilino1)
| # | Passo | Resultado esperado |
|---|---|---|
| 1 | Entrar; `/dashboard/conta/perfil` e completar o perfil | Perfil salvo; aviso de campos pendentes some |
| 2 | `/buscar`, filtrar por Uberlândia | Lista com o anúncio "[TESTE QA] Apto mobiliado 2 quartos"; sem endereço completo nem coordenada exata |
| 3 | Abrir o anúncio e **Candidatar-se** | Candidatura criada; o inquilino não vê status "recusada" em nenhum caso |
| 4 | Aguardar o proprietário **pré-aceitar** (lado dele, passo 3) | Notificação; contato do proprietário continua mascarado até o aceite |
| 5 | `/dashboard/verificacao` e documentos | Documentos enviados; verificação mostra laudo "TESTE — verificação simulada" |
| 6 | `/dashboard/fechamento` | Etapas liberadas em ordem; nenhuma cobrança real; comissão aparece simulada/TESTE |
| 7 | Gerar contrato para assinatura | Contrato em modo teste (marca "MINUTA DE TESTE — sem validade"); sem envio real ao ZapSign |
| 8 | `/dashboard/conta` → Caixa de e-mails de teste; ler o código de 6 dígitos | Código visível só nos e-mails dele; assinar com o código |
| 9 | `/dashboard/locacoes` e `/dashboard/contratos` | Locação ativa com o contrato; painel sem ações indevidas |

## Lado do proprietário (proprietario1)
| # | Passo | Resultado esperado |
|---|---|---|
| 1 | Entrar; `/dashboard` | Painel com os 5 imóveis; apenas os publicados contam como ativos |
| 2 | `/dashboard/candidaturas` | Candidatura do inquilino1; identidade e contato ocultos até o aceite |
| 3 | **Pré-aceite** | Inquilino notificado; identidade ainda oculta |
| 4 | Calendário do imóvel (pílula, #694) | Período da candidatura aparece como pílula; datas não somem ao navegar |
| 5 | `/dashboard/fechamento` | Fechamento libera; taxa congelada no aceite; nenhuma cobrança real (TESTE) |
| 6 | Assinar o contrato (código de 6 dígitos na Caixa de e-mails de teste dele) | Contrato assinado dos dois lados, em modo teste |
| 7 | Modo app (#686) | Mesmo fluxo no menu do app, sem quebra em 390 px |

## Regras que o Muse deve vigiar
Sem "temporada", "vistoria" (é "conferência de entrada"), "aluguel/comissão/corretagem/intermediação" em texto público;
garantia = "Caução"; sem endereço completo nem coordenada exata em página pública; "Plataforma em fase de testes.
Lançamento oficial em 2027."; a plataforma nunca toca em dinheiro.

## Pendências conhecidas (lidas no banco em 17/10, sem escrita)
- proprietario1 tem 1 imóvel `active` ("[TESTE QA] Apto mobiliado 2 quartos – Santa Mônica") e 4 rascunhos.
- Esse imóvel **não tem linha em `documents`** (nenhum documento aprovado) e `limpeza_estadia` está vazio.
  O item 4 da ordem (documento aprovado + pacote de limpeza pago + segundo imóvel sem pacote) **depende de dado
  em produção**, que agente não escreve: precisa do Daniel (ou migração aprovada por ele).
- Fora o item 4, o roteiro roda até a assinatura sem efeito real.
