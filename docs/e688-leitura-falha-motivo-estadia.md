# Varredura "leitura que falha não vira não encontrado" — motivo da estadia no perfil

- **Ponto**: `requestLead` (`src/lib/data/actions.ts`), candidatura sem motivo escolhido: o motivo vem de `profiles.motivo_estadia`.
- **Defeito**: o erro da leitura era ignorado; `perfil` vinha `null`, o motivo ficava `null` e a candidatura seguia sem motivo (o dono veria "não informado" por erro nosso).
- **Correção**: confere o erro e devolve `MSG_CONTATO_SEM_LEITURA` ("Não foi possível enviar agora. Tente de novo em instantes."), igual às outras leituras do mesmo fluxo. Perfil sem motivo (sem erro) segue como antes.
- **Teste**: `src/lib/data/e688-motivo-perfil-leitura.test.ts` (visto vermelho antes da correção).
- **Sem** migração, chave ou mudança de e-mail.
