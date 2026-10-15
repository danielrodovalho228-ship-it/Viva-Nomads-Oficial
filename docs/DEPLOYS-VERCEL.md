# Deploys na Vercel — reduzir previews (ordem 876fc504, decisão pendente do Daniel)

**Situação:** o plano Hobby limita 100 deploys/dia. Cada push em branch de PR gera um preview e conta no limite;
quando estoura ("Deployment rate limited — retry in 24 hours"), merges na `main` ficam sem deploy de produção.

**Decisão desta ordem: `vercel.json` NÃO foi alterado.** A ordem manda manter os previews quando algo depende deles.
Conferido em 15/10/2026:

| Quem | Depende do preview? | Evidência |
|---|---|---|
| Laboratório (`.github/workflows/laboratorio.yml`) | **Não** | sobe build local em `localhost:3123` no próprio Actions |
| E2E (`.github/workflows/e2e.yml`, gatilho `deployment_status`) | **Em parte** | em preview só roda com o segredo `VERCEL_AUTOMATION_BYPASS_SECRET`; sem ele pula (`scripts/ci/e2e-alvo.sh`). Os runs de preview duram ~12 s e passam, ou seja, hoje estão sendo pulados. Em produção roda sempre (só specs públicos) e continua rodando |
| Revisão do Moacir | **Sim** | as rondas dele citam "preview READY"/"sem preview no Vercel" como evidência por PR (57 menções em 3 dias); sem preview ele perde essa conferência |
| Check "Vercel" do PR | **Sim** | status `Vercel — Deployment has completed` aparece em cada PR |

## Como aplicar (se o Daniel decidir desligar os previews)

```json
"git": { "deploymentEnabled": { "main": true, "*": false } }
```

Conferir na documentação da Vercel antes (`git.deploymentEnabled` aceita nome de branch; confirmar se o curinga `*` é aceito
— se não for, listar os prefixos: `"renato/*": false`, `"renato-b/*": false`, `"renato-c/*": false`, `"renato-d/*": false`, `"claude/*": false`).
Manter o resto do `vercel.json` como está hoje no repositório (região `iad1` e os 4 crons: resumo-pedidos, atendimento,
avisos-daniel, checkin-lembretes — a ordem citava `gru1` e 3 crons, mas a `main` já mudou).

**O que quebra:** a conferência de preview do Moacir e o E2E de preview (se o segredo de bypass for criado um dia).

## Alternativas

1. **Previews só para um prefixo** (ex.: `renato/*` e `claude/*`; desligar `renato-b|c|d`). Corta a maior parte dos deploys e mantém uma amostra para o Moacir.
2. **Lab no Actions em todo PR** (build local, sem Vercel) e previews desligados; o Moacir passa a usar o resultado do lab como evidência.
3. **`ignoreCommand`** no `vercel.json` para pular o build em commits que só mudam `docs/`, `tests/` ou `e2e/` (esses commits não precisam de preview).
4. **Manter como está** e subir o plano da Vercel.

## Como desfazer

Remover o bloco `git` de `vercel.json`, ou trocar `"*": false` por `true`. Um commit.
