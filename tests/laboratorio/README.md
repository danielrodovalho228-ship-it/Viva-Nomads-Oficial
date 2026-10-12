# Laboratório de testes

Cópia completa do sistema, separada da produção, que roda toda noite no GitHub
Actions (`.github/workflows/laboratorio.yml`, 01h do Texas).

1. **Supabase local** (CLI + Docker, `supabase/config.toml`): sobe do zero e
   aplica todas as migrações de `supabase/migrations/`.
2. **Acerto com produção** (`supabase/lab/alinhar-producao.sql`): o que
   produção tem diferente do repositório (`profiles.role` como texto e 4
   políticas repetidas). Conferido em 07/10/2026 comparando colunas, funções,
   gatilhos e políticas.
3. **Personas** (`scripts/lab/seed-lab.mjs`), e-mails `@lab.vivanomads.test`,
   senha nova a cada noite:
   - Ana Lima, Ana Costa, Ana Souza — inquilinas;
   - Paulo Gratuito, Paulo Essencial, Paulo Profissional, Paulo Gestor (20
     imóveis com documentação aprovada) — proprietários;
   - Roberta — admin;
   - Gustavo — o "invasor" dos testes de segurança.
   O script recusa qualquer banco que não seja `127.0.0.1`/`localhost`.
4. **Integrações simuladas** (`INTEGRACOES_SIMULADAS=on`): e-mail, WhatsApp,
   Asaas, ZapSign, CAF e IA não chamam ninguém; o que "teria sido enviado" vai
   para `tests/laboratorio/saida/envios-simulados.jsonl`. Em produção a chave
   é ignorada e o build recusa ligá-la.
5. **Suíte E2E** (Playwright) contra `http://localhost:3123`.

   Specs de uso real (contas novas por spec, fotos PNG geradas no próprio teste):
   t34 vários imóveis por dono e limite do plano, t35 troca de plano com imóvel
   cadastrado, t36 cadastro de ponta a ponta (CPF → fechamento), t37 simuladores
   e números contra `config/planos.ts`. Defeito que o teste revela NÃO é
   escondido: vira teste de "falha conhecida" (`test.fail`) e achado para o Otávio.

   Laboratório autônomo (ordem 225d0648): t41 mensagens e máscara de contato, t42 contato/telefone
   (nenhum `tel:`/`wa.me` antes do aceite), t43 notificações (push simulado, LAB_OUTBOX), t44 parceiros,
   t45 regra das 8 fotos (editor, API do dono e banco), t46 modo do app, t47 login social no app,
   t48 varredura de todo o sitemap e das telas logadas de cada persona a 390 px.
   A suíte também roda a cada merge na `main`; o resultado de cada execução vira uma linha em
   `public.lab_execucoes` (só admin lê; migração 0106) — `select * from lab_execucoes order by criada_em desc`.

Resultado: resumo na própria execução do Actions (tabela passou/falhou por spec) e o artefato
`laboratorio-<id>` com o relatório HTML, prints, vídeos e `resultado.json`.

## Rodar na sua máquina

```bash
npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta,mailpit,realtime
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/lab/alinhar-producao.sql
# exporte NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321, as chaves de `npx supabase status -o env`,
# INTEGRACOES_SIMULADAS=on e LAB_SENHA=<16+ caracteres>, depois:
node scripts/lab/seed-lab.mjs && npm run build && npx next start -p 3123
```
