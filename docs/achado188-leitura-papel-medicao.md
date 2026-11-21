# Achado 188 — medição de internet: leitura do papel que falha não vira "só o proprietário mede"

Em `src/lib/internet-medida-servidor.ts`, `papelNoImovel` (quem pode medir: o dono no cadastro/edição, ou o morador do
contrato ativo na conferência de entrada) lia o imóvel e o contrato sem olhar o `error`. A falha virava `null`, e as duas
ações de medição respondiam "Só o proprietário do imóvel (ou o morador, na conferência de entrada) mede a internet." — dizendo
ao próprio dono que ele não podia medir.

Agora a função devolve `"falhou"` quando a leitura não deu, e as duas ações respondem "Não foi possível conferir o imóvel agora.
Tente de novo." antes da mensagem de permissão. Quem de fato não é parte continua ouvindo a mensagem de permissão.

Teste: `src/lib/achado188-leitura-papel-medicao.test.ts` (escrito antes, visto vermelho). Sem migração, sem chave, sem prova
ao vivo. Nenhum dado de medição é tocado.
