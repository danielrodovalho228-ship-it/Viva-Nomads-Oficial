# E699 — As travas da publicação aparecem desde o passo 1

**Relato (QA Allinne, 07/11):** a confirmação de identidade e o documento do imóvel (matrícula) travam a publicação, mas só eram revelados no passo 10 ("Antes de publicar").

**Correção (sem migração, só UI):** um cartão "Para publicar, a Viva pede duas coisas" no topo do **passo 1** do cadastro (`travas-de-publicacao.tsx`), com o estado de cada item: identidade (mesmo critério do passo 10) e documento do imóvel (`docEstado`: aprovado = ok, em análise, ou falta). O cartão some quando as duas estão em ordem; enquanto a identidade carrega, não afirma "falta" (não pisca). Não trava nada: avisa e diz que dá para enviar quando quiser.

**Teste:** `src/lib/anuncio/travas-publicacao.test.ts` (visto vermelho antes; 6 ok, inclui a guarda de que o passo 1 monta o cartão).

**Fora desta correção:** o painel `/dashboard/imoveis` já lista "Continue seu anúncio" com os itens da prontidão (inclui "documento" e "qualificação"); não alterei. A ordem em que o documento e a identidade são enviados segue a decisão do Daniel de 18/10 (endereço → identidade → matrícula).
