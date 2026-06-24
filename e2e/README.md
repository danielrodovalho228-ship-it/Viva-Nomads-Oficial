# E2E de regressão

Testa as implementações principais (fechamento/garantia/caução flexível/serviços,
reembolso, cadastro de imóvel) dirigindo a app real com Chromium (Playwright).

Roda em **modo demonstração** (sem Supabase): valida **UI, fluxo, regras e
textos** — não o backend real (persistência, e-mail, PDF).

## Como rodar

```bash
# 1) Suba a app (em outro terminal ou em background)
npm run build && npm run start          # porta 3000 por padrão

# 2) Rode o E2E apontando para a app no ar
E2E_BASE_URL=http://localhost:3000 npm run e2e
```

Sai com código `!= 0` se encontrar qualquer bug, erro de console ou exceção —
bom para usar como passo de verificação antes de um deploy.

## Variáveis

| Variável | Padrão | O que é |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:3000` | URL da app já rodando |
| `E2E_CHROME` | caminho do sandbox | executável do Chromium/Chrome |

> Precisa do `playwright-core` instalado e de um Chromium. Se não tiver um Chrome
> local, aponte `E2E_CHROME` para um binário do Chromium (ex.: o do Playwright).
