# E775 — fila de merge do GitHub (merge só com o gate completo verde)

O repositório é PÚBLICO (`private=false`): fila de merge disponível sem organização e minutos de runner padrão gratuitos.

## O que o código já faz (este PR)
- `merge_group:` nos três workflows que formam o gate: `ci.yml` (**verify**), `lab-critico.yml` (**lab-critico**) e `laboratorio.yml` (a suíte completa em **16 fatias**; o job `consolidar` se chama **`suite-completa`**).
- Na fila, o GitHub cria um commit temporário (`gh-readonly-queue/main/...`) com a main + os PRs enfileirados, roda esses checks nele e só então funde. Falhou, o PR sai da fila; passou, entra na `main`.

## O que falta fazer nas CONFIGURAÇÕES do repositório (precisa de admin: o agente não tem essa permissão)
Settings → Rules → Rulesets → New branch ruleset, alvo `main`:
```json
{
  "name": "main: fila de merge e gate completo",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "rules": [
    { "type": "merge_queue", "parameters": {
        "merge_method": "SQUASH",
        "grouping_strategy": "ALLGREEN",
        "min_entries_to_merge": 1,
        "max_entries_to_merge": 5,
        "min_entries_to_merge_wait_minutes": 5,
        "max_entries_to_build": 5,
        "check_response_timeout_minutes": 90 } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [
          { "context": "verify" },
          { "context": "lab-critico" },
          { "context": "suite-completa" } ] } }
  ]
}
```
- **`merge_method`**: o repositório hoje usa "Merge pull request" nos commits da `main`; se a preferência for manter, trocar `SQUASH` por `MERGE`.
- **Não** colocar `e2e` (roda em `deployment_status` da Vercel, que não existe para o commit da fila) como check obrigatório da fila.
- A suíte completa leva ~40 min por rodada: com `max_entries_to_merge: 5` até 5 PRs entram juntos numa só rodada (`ALLGREEN`: se um falha, o grupo é refeito sem ele).

## Ordem de ativação
1. Mesclar este PR (e o do E744, que traz o `merge_group` e o nome `suite-completa`).
2. Rodar o laboratório uma vez por `workflow_dispatch` para o check `suite-completa` existir (o GitHub só deixa escolher checks que já reportaram).
3. Criar o ruleset acima; testar com um PR de documentação.
