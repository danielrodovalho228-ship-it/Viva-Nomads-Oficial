# E778 — evidência do Superpowers na Pista A (09/11/2026)

Coletada na sessão da Pista A (Claude Code 2.1.319, modelo configurado `claude-sonnet-5-5`):

- **Configuração do repositório:** `.claude/settings.json` declara `enabledPlugins: { "superpowers@claude-plugins-official": true }` e o marketplace `anthropics/claude-plugins-official`.
- **Instalação nesta sessão: NÃO.** `~/.claude/plugins/installed_plugins.json` está vazio (`"plugins": {}`); o diretório do marketplace existe, mas não há nenhum `SKILL.md` do Superpowers em disco. Nenhuma skill do Superpowers aparece na lista de skills disponíveis da sessão (só as embutidas: `code-review`, `simplify`, `loop`, `run`, `security-review`, `init`, `update-config`, `claude-api` e as `anthropic-skills:*`).
- **Consequência:** nenhuma skill do Superpowers foi invocada por esta pista. As regras da casa (CLAUDE.md) foram seguidas à mão: o prompt é a decisão, plano só na descrição do PR, TDD/verificação escopada, nada de merge. O fluxo ficou assim: teste escopado → `tsc` → PR draft.
- **Como foi feito na sessão do coordenador:** não tenho acesso àquela sessão; peço ao coordenador que cole a versão e a lista de skills ativas para compararmos.
- **Possível causa:** plugins habilitados por `settings.json` num container novo só carregam depois que o marketplace é confiado/instalado; aqui isso não aconteceu (sem prompt de confiança no ambiente remoto). Correção seria do ambiente (instalar o plugin no setup do container), não do código. Não alterei configuração de ambiente.
