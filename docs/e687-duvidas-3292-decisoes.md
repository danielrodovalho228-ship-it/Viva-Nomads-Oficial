# E687 — as três dúvidas do PR #3292 (mesclado): decisão e evidência

O #3292 (migração 0326) foi mesclado em 08/11. Ele deixou três dúvidas no corpo. Aqui a decisão de cada uma, com o que foi conferido no código da `main`. Nenhuma pede código novo.

## 1. A spec `fluxo-parceiros-completo` (§2, fases 0 e 4) não estava acessível
Segue inacessível a esta pista. A implementação seguiu o código existente (cadastro pede empresa e veículo em `validarSolicitacao`/`dadosCategoria`; a ativação copia para `parceiros.dados_categoria`; o painel mostra "Empresa de mudança" e "Veículo"). **Decisão:** nada a mudar até alguém com a spec apontar uma divergência concreta; quando houver, o ponto de troca é só `lib/parceiros/ativacao-nucleo.ts` e o bloco do painel.

## 2. Empresa e veículo na página pública do parceiro
**Decisão (opção conservadora, a recomendada): não vão à página pública.** Motivos: (a) exigiria alterar a função pública de segurança que alimenta a página, e a regra da casa é não ampliar o que sai por ela sem o parecer de privacidade; (b) o veículo pode identificar a pessoa (porte, uso próprio); (c) o morador contrata pelo nome público e pelos serviços, não por esses dois campos. Se o Daniel quiser a empresa (só o nome fantasia) na página pública, é uma troca pequena e separada, com a função de segurança revista junto.

## 3. "Tela que mostra Mudança como Outro serviço" — não localizada
Procurei de novo na `main` (08/11). **Não existe tela que troque Mudança por "Outro serviço":**
- `rotuloCategoria("mudanca")` devolve "Mudança" (`lib/parceiros/regras.ts`); só um valor desconhecido cai em "Serviço", e "Outro serviço" é o rótulo da categoria `outro`.
- A página pública `/parceiros` tem o cartão "Montagem e mudança" com os links "Atender mudança" e "Procurar mudança" (`?categoria=mudanca`).
- "Parceiros do imóvel" (vínculo fixo) cobre só limpeza, manutenção, lavanderia e fotografia **por desenho**; mudança não é vínculo fixo.
**Hipótese para o relato original:** dado antigo (pedido criado antes de a categoria existir como própria, gravado como `outro`) ou a categoria escolhida por engano no formulário. Para localizar de fato falta a tela e a URL exatas em que a QA viu o rótulo.

## O ramo positivo (massa)
O PR #3402 (migração 0329) cria o parceiro de Mudança aprovado em conta de teste para a QA ver a própria empresa e o veículo no painel.
