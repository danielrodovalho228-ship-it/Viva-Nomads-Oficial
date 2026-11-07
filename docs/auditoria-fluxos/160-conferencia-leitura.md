# Achado 160 — conferência: falha de leitura do contrato virava "Você não faz parte deste contrato"

**Fluxo:** morador e proprietário na conferência de entrada/saída (`src/lib/data/conferencia-actions.ts`).
**Defeito:** `parteDoContrato` não olhava o `error` da leitura do contrato; com o banco fora do ar devolvia `null` e as cinco ações (registrar item, padrão mínimo, responder, enviar foto, fechar) diziam à própria pessoa "Você não faz parte deste contrato."
**Correção:** o erro de leitura lança `LeituraDoContratoFalhou`; as ações usam `contextoDaConferencia` e dizem "Não foi possível ler o contrato agora. Tente de novo."; "não faz parte" fica só para quem de fato não é parte. O leitor da página (`conferenciasDoContrato`) passa a lançar, e o `error.tsx` mostra "Tentar de novo".
**Teste:** `src/lib/data/achado160-conferencia-leitura.test.ts`.
