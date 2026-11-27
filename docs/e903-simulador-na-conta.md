# E903 — /para-proprietarios diz que o simulador fica na conta

**Defeito:** o bloco "Simulador de rentabilidade" prometia a ferramenta ao visitante. O botão "Calcular rentabilidade" levava a `/dashboard/simulador`, que exige conta, e o visitante caía no login sem aviso.

**Correção mínima (o simulador NÃO fica público):**
- O bloco ganha a nota: "O simulador fica na sua conta: entre ou crie a sua, grátis, para calcular."
- O botão passa a "Entrar para calcular".
- O destino não muda. O proxy leva à entrada e, depois de entrar, de volta ao simulador.
- Os textos estão em `src/lib/simulador-na-conta.ts`.

**Teste:** `src/lib/e903-simulador-na-conta.test.ts`, vermelho na main e verde na branch.

**Asserção alterada:** `e718-proprietarios-blocos.test.ts`, onde o botão "Calcular rentabilidade" passa a `{BOTAO_SIMULADOR_PUBLICO}`.
