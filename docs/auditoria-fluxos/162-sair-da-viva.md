# Achado 162 — "Sair da Viva": leituras e gravações que falham eram ditas como sucesso

**Fluxo:** conta → Sair da Viva (morador, proprietário, parceiro) e painel de qualidade do admin (`src/lib/saida/acoes.ts`, `src/components/account/sair-da-viva.tsx`).
**Defeitos:**
1. `estadoSaida` ignorava o `error` de seis leituras; com o banco falhando, a tela dizia "Você não tem pendências. Se quiser, pode apagar seus dados." (contrato em vigência, caução e pedidos abertos sumiam da conferência).
2. `pausarConta` dizia "Conta pausada" mesmo se a retirada dos anúncios e da página de parceiro falhasse (anúncios seguiam na busca).
3. `adminFecharCorrecao` dizia "Correção não encontrada." com a leitura falhando e "Correção fechada." com a gravação falhando; `adminEstadoDenuncia` dizia "Estado atualizado." com a gravação falhando.
**Correção:** `estadoSaida` lança em qualquer falha; a tela mostra "Não conseguimos conferir as suas pendências agora" com "Tentar de novo" e desabilita "Apagar meus dados" até a leitura voltar; a pausa só confirma com a retirada feita; as duas ações do admin confirmam a gravação.
**Teste:** `src/lib/saida/achado162-saida-leitura.test.ts`.
