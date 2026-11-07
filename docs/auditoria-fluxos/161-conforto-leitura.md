# Achado 161 — pendências do padrão mínimo: falha de leitura virava "Pendência não encontrada" / "Sem permissão"

**Fluxo:** dono, morador e admin agindo numa pendência do padrão mínimo (`src/lib/data/conforto-actions.ts`).
**Defeito:** `agirNaPendencia` lia a pendência sem olhar o `error` ("Pendência não encontrada." quando o banco falhava) e `papelNoContrato` devolvia `null` na falha ("Sem permissão." ao dono/morador do contrato).
**Correção:** `papelNoContrato` lança `LeituraConfortoFalhou`; `agirNaPendencia` destrincha o erro da pendência e captura a falha do papel, dizendo "Não foi possível ler esta pendência agora. Tente de novo."
**Teste:** `src/lib/data/achado161-conforto-leitura.test.ts`.
