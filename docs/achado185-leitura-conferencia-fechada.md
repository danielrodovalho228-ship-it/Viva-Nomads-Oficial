# Achado 185 — conferência: leitura de "fechada" que falha não vira "aberta"

Em `src/lib/data/conferencia-actions.ts`:
- `estaFechada` lia `conferencias` sem olhar o `error` e devolvia um booleano: a falha virava "não está fechada" e as quatro
  ações de escrita (resposta, item, laudo, arquivo) seguiam como se a conferência estivesse aberta (só o banco ainda recusava,
  com outra mensagem). Agora `motivoDeFechada` devolve o motivo: "já foi fechada", "Não foi possível ler a conferência agora.
  Tente de novo." ou nada (aberta). As quatro ações usam o motivo.
- Ao anexar laudo, a leitura de "já tem laudo" sem olhar o `error` deixava seguir para anexar um segundo por cima. Agora para
  com a mesma mensagem de leitura.

Não toca no registro de nenhuma conferência fechada (a VN-CT-11281A61 segue como está).

Teste: `src/lib/data/achado185-leitura-conferencia-fechada.test.ts` (escrito antes, visto vermelho). Sem migração, sem
chave, sem prova ao vivo.
