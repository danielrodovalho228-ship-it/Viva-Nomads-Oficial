# E788 — avatar "Equipe" inerte e inicial inconsistente (cabeçalho do admin)
1. O selo "Equipe" (papel-ativo, área da equipe) mostrava um círculo de avatar que não abre nada. E474 (iii)/E479 decidiu que o selo não é link (a Conta tem um caminho só: "Minha conta →" na barra lateral). Mantive essa decisão e escolhi a saída "removido se não tem função": o selo agora é só texto.
2. Inicial "c" × "C": a função `iniciais()` já devolve maiúscula nos dois lugares; a 28 px a letra caía em ~11 px e a maiúscula parecia minúscula. O Avatar passa a desenhar a inicial com no mínimo 13 px (`TAMANHO_MINIMO_INICIAL`) e com `uppercase`.
Teste: `src/components/layout/e788-selo-equipe-sem-avatar.test.ts` (+ E474 e avatar). Sem prova ao vivo (QA).
Se o Daniel preferir o avatar funcional (link para a Conta), é reverter o E474 (iii): decisão dele.

## Reprova de 11/11 (a volta à Pista B): avatar funcional e iniciais iguais em toda superfície

A prova ao vivo reprovou as duas saídas anteriores: o círculo que não abria nada e o texto "Equipe" sem círculo e sem clique. A ordem foi "avatar funcional (ou removido se não tem função)". Como a remoção já tinha sido reprovada, o avatar passou a ser **funcional**.

### O que mudou

- **Selo da equipe:** o `SeloEquipe` (`components/layout/papel-ativo.tsx`) é o avatar da própria conta seguido de "Equipe ▾". Ele usa o mesmo `MenuConta` dos outros papéis (`topo-dono.tsx`, que ganhou o `rotulo` opcional) e abre o menu **Minha conta · Ajuda · Sair**, definido em `itensDaEquipe()` (`config/abas-painel.ts`).
  - O menu não traz "Painel admin", porque quem o abre já está no admin.
  - Também não traz troca de modo.
- **Iniciais:** o avatar do topo, o do rodapé da barra lateral, o do topo do site e o do Perfil usam o **nome completo** (`nomeParaAvatar` / `nomeAvatarExibicao`). Antes, o primeiro nome dava "C" e "P" enquanto o Perfil mostrava "CQ" e "PP". A marca "[TESTE QA]" não conta como iniciais.
- **`PapelAtivo`** fica só para os papéis com Perfil (link + avatar); a casca escolhe entre ele e o `SeloEquipe`.

### Asserção alterada

`src/lib/admin/e474-duplicidades.test.ts`, E474 (iii):

- **Antes:** "o selo é texto com `cursor-default`, sem `<button>`".
- **Agora:** "o selo não é `<Link>` para a Conta; é o `MenuConta`".
- **Decisão citada:** reprova do E788 na prova ao vivo de 11/11.
- **Continua guardado:** o "Minha conta →" da barra lateral.

### Testes

- `node --test src/components/layout/e788-selo-equipe-sem-avatar.test.ts`: falhava antes da correção (`itensDaEquipe` não existia) e passa depois.
- `src/components/layout/e788-iniciais-iguais.test.ts`.
- `src/lib/admin/e474-duplicidades.test.ts`.
- E2E de laboratório `tests/e2e/specs/t1606-e788-avatar-equipe.spec.ts`, a 1280 e a 390 px. Ele confere:
  - que o selo abre o menu com os três itens;
  - que "Minha conta" leva à Conta;
  - que as iniciais do topo, do rodapé e do Perfil são iguais.
