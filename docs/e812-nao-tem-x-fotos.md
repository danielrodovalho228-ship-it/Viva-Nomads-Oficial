# E812 — o "Não tem" desmentia as fotos

**Achado.** RELATORIO-011 e RELATORIO-016:
- Seis exemplos (ube-003, 005, 008, 010, 012 e 013) diziam "Não tem: TV", mas a foto da sala mostra uma TV grande.
- O ube-003 tinha 1 item só em "O que tem por perto" e não tinha a seção "Serviços por perto".

**Causa.** O "Não tem" (`src/lib/anuncio/nao-tem.ts`) é derivado: todo item esperado que o dono não marcou vira
"Não tem". Ninguém olhava a foto.

**Verificação.** As salas desses 6 exemplos (`public/images/imoveis/ube/ube-0XX-sala.webp`) mostram a TV. Os 6 são
exatamente os exemplos que listavam "Não tem: TV".

**Correção.**
1. **Dados dos exemplos:**
   - "TV" entra na lista "Tem" dos 6.
   - O ube-003 deixa de ser o anúncio "enxuto": ganha arredores como os outros (ônibus, mercado, farmácia, escola e
     pronto atendimento), e com eles aparecem os 3 "Serviços por perto".
2. **Fluxo real:**
   - A detecção por foto (DETECTA-B) passa a procurar também TV, lava-louças e ar-condicionado, a lista
     `COMODIDADES_VISIVEIS_EM_FOTO`. Máquina de lavar e garagem ela já procurava.
   - Comodidade vista na foto e ainda pendente para o dono (sugestão "sugerida" ou "confirmada sem foto") **sai do
     "Não tem"** da página pública (`Property.vistoNasFotos`, carregado no servidor por `attachVistoNasFotos`).
   - O dono recebe a sugestão no painel ("Encontramos isto numa foto sua"); esse é o alerta. Ao aceitar, o item é
     marcado. Ao descartar, a sugestão deixa de estar pendente e o item volta ao "Não tem".
   - A detecção só roda com a chave `DETECCAO_FOTOS_ATIVO` ligada. Desligada, a página fica como antes.

**Teste.** `src/lib/anuncio/e812-nao-tem-x-fotos.test.ts` (5): falha na main (5 de 5) e passa na branch.
- Nenhum exemplo diz "Não tem: TV".
- ube-003 com os 3 serviços por perto.
- Item visto na foto fora do "Não tem".
- A detecção procura as 3 comodidades novas.
- A página carrega o que foi visto antes de montar a lista.

**Asserção alterada.** `src/lib/fotos/deteccao.test.ts` ("lista fechada"): a lista de comodidades da detecção passa a
incluir as do "Não tem" visíveis em foto.
