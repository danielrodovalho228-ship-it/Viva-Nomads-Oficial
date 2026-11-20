@AGENTS.md

## Superpowers — regras da casa

O plugin `superpowers@claude-plugins-official` fica ligado em `.claude/settings.json`. Ele vale com estas regras, que vencem as do plugin:

1. **O prompt recebido é a decisão.** O brainstorming não para para perguntar. A dúvida vai para a seção "Dúvidas" do PR, e o trabalho segue pela leitura mais conservadora.
2. **Plano só na descrição do PR.** Nada de arquivo de plano no repositório.
3. **Nunca fazer merge, nunca apagar branch remota, nunca dar push na `main`.** A sessão termina em um PR aberto.
   - **Finishing → só PR.** Ao terminar (skill `finishing-a-development-branch`), a única opção é abrir/atualizar o PR; nunca merge local, nunca descartar a branch.
4. **Subagentes só em tarefa grande.**
5. **TDD, depuração sistemática, revisão e verificação são obrigatórios.** Eles não substituem o QA do Muse.
6. **Seguem valendo:** o AGENTS.md, o vocabulário da casa e o 3S.
7. **"Pronto" (ready) só com a saída do teste colada.** Nenhum PR sai de draft, nem se declara pronto, sem colar na descrição ou no relato a saída real do teste escopado (comando + contagem de pass/fail). Sem saída colada, o PR fica em draft.
