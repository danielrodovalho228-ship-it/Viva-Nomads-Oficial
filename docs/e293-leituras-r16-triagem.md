# Erros/estados vazios — rodada 16 (comprovante de vínculo da triagem)
Mesmo padrão das rodadas 9–15: leitura que falha não vira "vazio".
- `linkMeuVinculo`: erro ao ler o envio do morador não vira "Nenhum comprovante enviado."
- `linkVinculoAdmin`: erro ao ler o envio não vira "Não encontrado."
- `decidirVinculo`: erro do banco no `update` não vira "Este envio já foi decidido ou foi trocado pelo morador" (a equipe achava que outra pessoa tinha decidido); só a ausência de linha atualizada vale isso.
As três devolvem "Não foi possível conferir o comprovante agora. Tente de novo em instantes."
Teste: `src/lib/data/e293-leituras-triagem.test.ts`. Sem migração, sem prova ao vivo. `AUTOMACOES_ATIVO` intocado.
