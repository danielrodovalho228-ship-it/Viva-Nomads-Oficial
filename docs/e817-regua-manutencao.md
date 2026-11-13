# E817 — uma régua de manutenção no anúncio e na Ajuda

**Achado** (RELATORIO-011 e RELATORIO-014):
- **Anúncio:** prometia prazo de **solução** ("urgente com solução provisória em até 24 h e definitiva em até 72 h ·
  comum em até 72 h · demais em até 7 dias"), sem dizer quem resolve nem como acionar.
- **Ajuda (/ajuda/contratos):** prometia prazo de **resposta** do proprietário ("4 horas em urgências, 24 horas nos
  casos médios e 72 horas nos demais").
- **Resultado:** para o mesmo vazamento, 4 h num lugar e 24 h no outro; "demais" era 72 h na Ajuda e 7 dias no anúncio.
  Nada dizia o que acontece se o prazo vencer.

**O que o código já faz** (nada novo foi prometido):
- **Prazo de resposta do proprietário** (`PRAZO_MANUTENCAO_H`): urgente 4 h, média 24 h, baixa 72 h.
- **Prazo de solução** (`PRAZO_SOLUCAO_H`): urgente, provisória 24 h e definitiva 72 h; média 72 h; baixa 168 h, ou 7 dias.
- **Quem resolve:** o proprietário. Com contrato ativo, o pedido é aberto pelo contrato ("Problema com isto?").
- **Prazo vencido** (`manutencao-avisos.ts`): o morador é avisado e pode chamar um parceiro de manutenção pela própria
  ordem.
- **Selo** (`SELO_MANUTENCAO`, `ranking/ordem.ts`): 3 soluções fora do prazo em 90 dias tiram o selo do anúncio.

**Régua única** (`src/config/atendimento.ts`):
- `linhasReguaManutencao()`: uma linha por prioridade, com os **dois** prazos e os exemplos. Ex.: "Urgente (sem água,
  sem luz, vazamento): resposta em até 4 h, solução provisória em até 24 h e definitiva em até 72 h".
- `COMO_ACIONAR_MANUTENCAO` e `SE_O_PRAZO_VENCER`.
- **Anúncio** (`textoCompromissoManutencao`, linha "Manutenção" do "Bom saber"): as 3 linhas, mais quem resolve e como
  acionar, mais o que acontece no atraso.
- **Ajuda e atendimento** (`frasePrazosManutencao`): as mesmas 3 linhas e o que acontece no atraso. O "como abrir" segue
  na própria resposta da Ajuda, que muda conforme o perfil (visitante, sem contrato, com contrato; regra do teste
  "FAQ manutenção").

**Testes.**
- `src/lib/e817-regua-manutencao.test.ts` (3): falha na main (o export não existe) e passa na branch.
  - Os dois prazos de cada prioridade saem das constantes.
  - Anúncio e Ajuda contêm as mesmas linhas e o mesmo "se o prazo vencer".
  - Saíram os termos soltos ("comum", "demais", "horas em urgências").
  - Quem resolve e o atraso ficam conferidos.
- Asserções alteradas:
  - `conforto/exibicao.test.ts`: o texto exato.
  - `anuncio/resumos-imovel.test.ts`: as linhas do "Bom saber".
  - `atendimento/atendimento.test.ts`: "4 horas" passa a "resposta em até 4 h".
  - E2E `t440-e98-imovel` e `t288-padrao-minimo-59a`: os textos.
- No lab, com o build da branch, o t440 passou (3 passed).
- O t288 falha no passo do cadastro ("Quanto custa por mês?" × "Título e descrição do anúncio") **também no build da
  main**. É falha anterior e não tem relação com este item.

## Reapresentação (13/11): lab-critico vermelho no head da473ade
**Causa**, reproduzida no lab com o branch atualizado com a main: o t288 entrou no lab-critico porque este PR mexe nele, e estava desatualizado em três pontos.
1. **Cenário 1:** o ajudante `continuarAte` (`tests/e2e/fixtures/cadastro.ts`) só escrevia o título na Descrição. Desde f9753c6 a Descrição exige 60+ caracteres, então o cadastro parava em "Título e descrição do anúncio". O ajudante agora escreve também uma descrição de apoio (`DESCRICAO_PADRAO_LAB`), o que vale para todo spec que usa o ajudante.
2. **Cenário 2:** no modo dono (padrão do dono, PROP-6), o Início mostra uma faixa só, a pendência mais urgente (`inicio-dono-alerta`), e não a `lista-decisoes`. O cenário passa a conferir essa faixa (manutenção vencida → /dashboard/solicitacoes) e abre a confirmação do padrão mínimo pela tela do imóvel.
3. **Cenário 4:** a página do imóvel já mostra a régua nova deste PR. O teste procurava o texto antigo "Demais em até 7 dias" e agora procura "resposta em até 72 h e solução em até 7 dias".

**Lab local:** t288 cenários 1–5 e t440 verdes. O cenário 6 (admin) cai no login do admin no meu lab local, o mesmo sintoma de outros specs de admin neste ambiente. O lab-critico do CI julga.

**Dúvida para o chat principal:** no modo dono, as outras decisões (ex.: "Confirme o padrão mínimo de X até …") não aparecem no Início, só a mais urgente. Se isso não for intencional, é item próprio.
