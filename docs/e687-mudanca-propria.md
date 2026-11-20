# E687 — Mudança/frete como categoria própria (auditoria E683, P3)

**Achado:** a categoria já é própria de ponta a ponta (`mudanca` ≠ `outro`; cadastro pede Empresa e Veículo; ficha do admin mostra). A lacuna real: empresa/veículo ficavam só no pedido e não chegavam ao parceiro aprovado.

**Correção (migração 0326):** `parceiros.dados_categoria jsonb` (default `{}`); a ativação copia do pedido; quem já foi ativado é preenchido pelo pedido de origem. O painel do parceiro (Dados) mostra "Empresa de mudança" e "Veículo" (`linhasDadosDaCategoria`). Classificada em `retencao.ts`.

**Dúvidas (conservador):**
1. A spec `fluxo-parceiros-completo` (§2, fases 0 e 4) não está no repo nem no Drive desta sessão; segui o que o código mostra. Se as fases pedirem outro dado de Mudança, ajusto.
2. Empresa/veículo **não** foram para a página pública (exigiria mudar a função pública `parceiros_publicos_lista`, que é de segurança). Decidir se devem aparecer ao público.
3. Qual tela mostra Mudança como "Outro serviço" segue não localizada no código (pode ser dado antigo).

Testes: `src/lib/parceiros/e687-dados-da-categoria.test.ts`. Sem prova ao vivo.

## Conferência de 11/11 e correção da massa (0338)
**Código na main: completo.** A 0326 está em produção (`parceiros.dados_categoria`), a ativação copia empresa/veículo do pedido e o painel do parceiro mostra "Empresa de mudança" e "Veículo" (`linhasDadosDaCategoria`, `painel-parceiro.tsx`). `e687-dados-da-categoria.test.ts`: 3/3.
**O que faltava: a massa.** A 0329 está registrada (`20261107000329`), mas em produção não há **nenhum** parceiro de Mudança (categorias existentes: fotografia, limpeza, vistoria). Causa: a guarda da 0329 parava se a conta `inquilino2` tivesse qualquer pedido de parceiro, e ela já tinha um pedido de limpeza **recusado**. Então a QA não tinha onde ver o painel de um parceiro de Mudança.
**0338:** a mesma massa da 0329 (mesmos ids `a0329…`, empresa e veículo fictícios), com a guarda certa: param só um parceiro na conta ou um pedido **aberto** (o mesmo conjunto do índice `parceiro_solicitacoes_uma_aberta_conta`). O pedido recusado fica intocado. Conferido no banco (só leitura): as restrições aceitam todos os valores e o índice único não barra um pedido `ativada` com outro `recusada` na mesma conta.
Teste: `src/lib/qa/massa-parceiro-mudanca-0338.test.ts`.
