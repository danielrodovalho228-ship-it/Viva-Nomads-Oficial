# E660 — Ficha "o que tem dentro" (dados)

Frente aprovada pelo Daniel (07/11/2026). Ordem: E660 → E663 → E664.

## O que entrou
- **Ficha** (`src/lib/ficha-dentro/ficha-dentro.ts`, puro, versão 1): por quarto, camas (casal, queen, king, solteiro, beliche, sofá-cama) e ar-condicionado; "solteiros que juntam" (cobrado só com 2+ solteiros no quarto); roupa de cama e banho (sim/não); cozinha equipada (sim/não).
- **Obrigatório:** camas e ar por quarto, enxoval, cozinha. **Opcional:** pratos e talheres (decisão da coordenação: obrigatório viraria base de reclamação) — nunca entram nas faltas.
- **Reuso, sem duplicar:** a ficha evolui as comodidades `enxoval` ("Roupa de cama e banho inclusas") e `cozinha_equipada` ("Cozinha equipada") e o item `ar_condicionado`; elas seguem no catálogo (filtros/busca) e não foram removidas.
- **Cadastro:** `FichaDentroCampos` no passo Comodidades; os quartos acompanham o número de quartos do passo Detalhes sem perder o que já foi respondido. Publicar anúncio NOVO exige a ficha completa; rascunho e edição de anúncio antigo seguem livres (anúncios anteriores ficam com `null`).
- **Gravação:** `createProperty`/`updateProperty` (`gravarFichaDentro`); edição sem ficha no envio não apaga a existente.
- **Congela no contrato:** na 1ª assinatura (`congelarFichaDentro`, junto do congelamento de pets) a ficha vai para `contratos.ficha_dentro_congelada` `{ficha, congeladaEm}`, uma vez só. Aditivo gera nova versão do contrato (E652) e, portanto, nova cópia; é essa cópia que a conferência de entrada (família E636–E640) deve ler — a tela da conferência lendo a ficha congelada fica para o próximo passo desta frente se o Daniel quiser a lista na própria conferência.
- **Migração 0316** (aditiva): `properties.ficha_dentro jsonb`, `contratos.ficha_dentro_congelada jsonb`; `aplicar-0316.sql` idempotente + rollback; inventário de retenção (E293) atualizado, sem exclusão nova.

## Testes
`src/lib/ficha-dentro/ficha-dentro.test.ts` (regras puras) e `src/lib/data/e660-ficha-guardas.test.ts` (gravação, congelamento, trava de publicação, migração). Módulos rodados inteiros: `src/lib/data`, `src/lib/anuncio`, `src/lib/ficha-dentro`, `src/config`, `src/lib/retencao`, `tests/migracoes` — verdes; `tsc` limpo.

## Dúvidas (para o PR)
1. Exibir a ficha na página pública do imóvel e na tela de conferência de entrada: não incluído aqui (a ficha congelada já está no contrato para a conferência ler).
2. Print da tela: depende de login no ambiente; não feito aqui (sem prova ao vivo).
