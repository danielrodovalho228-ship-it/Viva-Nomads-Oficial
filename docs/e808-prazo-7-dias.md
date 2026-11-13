# E808 — "Se não receber o valor, a Viva informa o proprietário em até 7 dias"

**Origem.** RELATORIO-010 (Phoenix, 12/11) citou em /como-funciona, cartão "Pagamentos": "Você paga a estadia direto na
plataforma, sem intermediários. Se não receber o valor, a Viva informa o proprietário em até 7 dias." Disse que o prazo
"para no aviso".

**Verificação (12–13/11).**
- A frase não existe no código da `main` (`27dbdf1`, a mesma de produção) nem em nenhum commit do repositório
  (`git log --all -S'Se não receber o valor'` e `-S'informa o proprietário em até'` sem resultado).
- O cartão "Pagamentos" diz: "Vão direto ao proprietário e ficam registrados na plataforma. Nada passa pela Viva Nomads."
- O mesmo relatório cita outras frases que também nunca existiram no repositório: "direto na plataforma, sem
  intermediários" (E804), "Você envia o link da cidade" (E806) e "documenta cada repasse". O próprio relatório avisa que
  a leitura de texto da /como-funciona "não captou o conteúdo renderizado". As citações não são literais.

**O que entra.**
- Nada a completar, e nenhum passo inventado: a Viva não cobra, não media e não garante o valor mensal.
- Guarda no gate do E776: a regra `prazo-de-aviso-sem-passo-seguinte`, com escopo em `src/app/(public)/`, impede que
  apareça em página pública "se não receber, a Viva informa/avisa em até N dias".
- Teste `src/lib/e808-pagamentos-sem-prazo-solto.test.ts`: trava o texto real do cartão e a regra nova. Falha na main
  (a regra não existe) e passa na branch.
