# E687 — Mudança/frete como categoria própria (auditoria E683, P3)

**Achado:** a categoria já é própria de ponta a ponta (`mudanca` ≠ `outro`; cadastro pede Empresa e Veículo; ficha do admin mostra). A lacuna real: empresa/veículo ficavam só no pedido e não chegavam ao parceiro aprovado.

**Correção (migração 0326):** `parceiros.dados_categoria jsonb` (default `{}`); a ativação copia do pedido; quem já foi ativado é preenchido pelo pedido de origem. O painel do parceiro (Dados) mostra "Empresa de mudança" e "Veículo" (`linhasDadosDaCategoria`). Classificada em `retencao.ts`.

**Dúvidas (conservador):**
1. A spec `fluxo-parceiros-completo` (§2, fases 0 e 4) não está no repo nem no Drive desta sessão; segui o que o código mostra. Se as fases pedirem outro dado de Mudança, ajusto.
2. Empresa/veículo **não** foram para a página pública (exigiria mudar a função pública `parceiros_publicos_lista`, que é de segurança). Decidir se devem aparecer ao público.
3. Qual tela mostra Mudança como "Outro serviço" segue não localizada no código (pode ser dado antigo).

Testes: `src/lib/parceiros/e687-dados-da-categoria.test.ts`. Sem prova ao vivo.
