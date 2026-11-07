# E700 — O checklist de publicação reflete as declarações na hora (Passo 10 e /dashboard/imoveis)

**Relato (QA Allinne, 07/11):** declarações (IPTU, água/luz/gás, convenção) feitas e termo aceito, mas o Passo 10 e o cartão de `/dashboard/imoveis` seguem listando "Declarações do imóvel (IPTU, água, luz e gás)" em "Falta para publicar".

## Duas causas (corrigidas, sem migração)

1. **O item dizia "declarações" mas media a elegibilidade COMPLETA.** `qualificacaoOk` era `isEligible(...)`, que inclui o **documento do imóvel** e a **operação** (proprietário/procurador) — os dois já têm item próprio na lista (`documento`, `sublocacao`). Com as declarações prontas e o documento ainda não enviado, o item de declarações continuava vermelho e a pessoa não sabia o que faltava. Agora `declaracoesDoImovelOk` (declarações + mobiliado + mínimo de 30 dias + convenção) alimenta o item, no editor e na lista de imóveis (`declaracoesDoRascunhoOk`). A elegibilidade completa continua travando o "Publicar" (`podePublicar` do editor) e o documento/operação continuam como itens separados: nenhuma trava foi removida.
2. **O autosave pendente era descartado se a pessoa saía da página em menos de 2 s.** A limpeza do efeito (`on = false; clearTimeout`) cancelava a gravação; quem marcava uma declaração e ia direto para "Meus imóveis" deixava o rascunho gravado velho, e a lista (que lê `draft_data`) seguia desatualizada. Agora o salvamento pendente de uma EDIÇÃO real (`gravacaoPendenteRef`) é gravado quando a página sai. Abrir o rascunho sem editar continua não gravando (E516).

## Testes
`src/lib/anuncio/e700-declaracoes-na-lista.test.ts` e `src/app/(dashboard)/dashboard/imoveis/novo/e700-autosave-ao-sair.test.ts` (vistos vermelhos antes). Ajustei três guardas de código que fixavam a forma antiga: `fotos-primeiro`, `e603-previa-listagem-passo5` e `rascunho-campos` (mesma intenção; o payload do autosave agora está em `montarGravacao`). `src/lib/anuncio`, `src/lib/data`, assistente de cadastro: 907 ok; `tsc` limpo.

Não reproduzido ao vivo.
