# E687 — Mudança/frete como categoria própria (auditoria E683, P3)

## Achado (código de `main`, conferido em 07/11)

A categoria **já é própria** de ponta a ponta; nenhum caminho de código leva Mudança a "Outro serviço":

- `CATEGORIAS_PARCEIRO` (`src/lib/parceiros/regras.ts`): `mudanca` ("Mudança") e `outro` ("Outro serviço") são valores distintos.
- Cadastro (`seja-parceiro-form.tsx`): quem marca Mudança vê **Empresa de mudança** e **Veículo**; o servidor (`validarSolicitacao`) recusa sem os dois ("Para mudança, informe a empresa e o veículo."). Coberto por `regras.test.ts`.
- Dados guardados em `parceiro_solicitacoes.dados_categoria`; a ficha do admin (`admin/parceiros/fichas.tsx`) mostra empresa · veículo.
- Constraints do banco aceitam `mudanca` (0190, 0215, 0220). Busca (`/parceiros/buscar?categoria=mudanca`), atalho `/parceiros/mudancas`, catálogo, foto e cartão da estadia usam `mudanca`.

## Lacuna real encontrada

Empresa e veículo ficam só na **solicitação**. Depois da aprovação não vão para a página pública do parceiro nem para o painel dele (`parceiros` não tem a coluna). Corrigir isso exige migração (`parceiros.dados_categoria`) e telas.

## Dúvidas (para o Daniel / coordenador)

1. Qual tela exata mostra Mudança como "Outro serviço"? Não achei no código; pode ser dado de produção (parceiro cadastrado antes com `outro`) ou um print antigo.
2. A lacuna acima (empresa/veículo na página pública e no painel) é o que o E687 quer? Se sim, abro a migração 0326 + telas num próximo PR.

Nenhuma mudança de código neste PR.

## Atualização (despacho de 07/11, "fluxo-parceiros-completo §2, fases 0 e 4")

Esse documento não está no repositório nem no Drive acessível a esta sessão (busca por título sem resultado), então não sei o que as fases 0 e 4 da matriz exigem de Mudança. Sem ele, não vou inventar migração. Pelo código, o que falta é só a lacuna acima (empresa/veículo não chegam à página pública nem ao painel do parceiro aprovado). Pedido: o trecho §2 e as fases 0 e 4 (ou confirmação de que a lacuna é o escopo). Com isso, o PR de código sai com a migração 0326.
