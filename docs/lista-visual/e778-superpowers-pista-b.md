# E778 — evidência do Superpowers na sessão da Pista B (09/11/2026)

Coletada na própria sessão, por leitura do disco e do que a sessão expõe. Mesmo formato do que a Pista A registrou no PR #3603.

## Habilitado no repositório
`.claude/settings.json`: `enabledPlugins: { "superpowers@claude-plugins-official": true }`, com o marketplace `claude-plugins-official` (origem `github`, repositório `anthropics/claude-plugins-official`). As regras da casa estão no `CLAUDE.md` (seção "Superpowers — regras da casa").

## Onde está instalado nesta sessão
- `~/.claude/plugins/installed_plugins.json`: `{"version": 2, "plugins": {}}`. **Vazio**, igual ao que a Pista A relatou.
- Mesmo assim o conteúdo do plugin **está presente e ativo**, por uma cópia sincronizada do ambiente: `~/.claude/plugins/synced/b8b372ac-7a8f-4eb5-a576-986b5112804f_dcf67dea-df66-4da0-9f25-3f03a65c0d01/6ba53849-2ee0-4cf0-957e-31c122ea1dd1/` (dados em `~/.claude/plugins/data/superpowers-synced`).
- `plugin.json`: nome `superpowers`, **versão 6.4.2**, autor Jesse Vincent, licença MIT, repositório `github.com/obra/superpowers`.
- Hook de início de sessão presente (`hooks/hooks.json`, `hooks/session-start`) e **executado**: o texto de `using-superpowers` chegou ao contexto no início da sessão.

## Skills ativas (as 15 que a sessão lista e que existem em `skills/` da cópia)
`superpowers:brainstorming`, `superpowers:diagnosing-superpowers`, `superpowers:dispatching-parallel-agents`, `superpowers:executing-plans`, `superpowers:finishing-a-development-branch`, `superpowers:receiving-code-review`, `superpowers:requesting-code-review`, `superpowers:subagent-driven-development`, `superpowers:systematic-debugging`, `superpowers:test-driven-development`, `superpowers:using-git-worktrees`, `superpowers:using-superpowers`, `superpowers:verification-before-completion`, `superpowers:writing-plans`, `superpowers:writing-skills`.

## Diferença em relação à evidência da Pista A
A Pista A relatou "nenhuma skill do Superpowers disponível". Nesta sessão (Pista B) as 15 skills estão disponíveis na lista da ferramenta `Skill`. O `installed_plugins.json` vazio não significa plugin ausente: aqui a carga vem da cópia sincronizada. Vale o coordenador conferir a sessão da Pista A por esse caminho.

## Limite honesto
Nesta sequência eu **não chamei** a ferramenta `Skill` para nenhuma skill do Superpowers; segui as regras da casa à mão: teste determinístico ligado a cada correção, depuração por causa (log antes de corrigir), verificação antes de afirmar (testes e `tsc` rodados, CI conferido), sem plano em arquivo, sem merge e sem subagente. Isto é evidência de **presença e de carga** do plugin, não de uso das skills.
