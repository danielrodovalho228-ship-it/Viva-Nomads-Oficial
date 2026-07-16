# Migrações — checklist de "aplicada em PRODUÇÃO?"

> **Regra (segurança, não preferência):** nenhuma migração fica só no código sem
> uma resposta a *"aplicada em produção?"*. **Migração não aplicada é bug
> fail-OPEN disfarçado de fail-closed** — o código depende de colunas que talvez
> não existam no banco real.

## Como obter EVIDÊNCIA (produção, não código)

**Automatizado (recomendado):**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://<PROD>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service_role_de_PRODUCAO> \
npm run check:migracoes
```
Sai `✅ APLICADA` / `❌ FALTANDO` por migração crítica e **exit 1** se faltar
qualquer migração de moderação (bloqueio do piloto).

**Manual:** cole `supabase/producao/verificar.sql` no SQL editor do Supabase de
produção (só leitura).

**Teste funcional (a prova final do furo):** em produção, com um imóvel de teste
cuja documentação está `pending` (não aprovada), tente **Publicar** → deve
**bloquear** ("documentação em conferência"). Só depois de o admin **Aprovar** na
fila `/admin/documentos` o botão publica. Se publicar com doc `pending`, a
migração 0042/0044 NÃO está aplicada.

## Aplicar o que falta

`supabase/producao/aplicar-piloto.sql` (gerado dos arquivos reais). Rode no SQL
editor **na ordem do arquivo**.

⚠️ **0044 tem um `UPDATE` de requeue** (`approved → pending`) que só deve rodar
**uma vez**. Se o check acima já mostra 0044 como APLICADA, **não** re-rode a
parte do `UPDATE` (as adições de coluna são idempotentes; o `UPDATE`
re-enfileiraria documentos já aprovados). Em dúvida, rode `check:migracoes` antes.

## Status (marque ao aplicar)

| Migração | O que trava se faltar | Aplicada em prod? |
|---|---|---|
| 0042 document_moderation | **Portão de publicar** (furo do YouTube) | ⬜ conferir |
| 0044 document_conference | Hash anti-fraude + auditoria quem/quando | ⬜ conferir |
| 0046 candidatura_aceite (#212) | Aceite persistido + comissão congelada | ⬜ ao mergear #212 |
| 0047 account_type (#212) | Gestor por elegibilidade + auditoria | ⬜ ao mergear #212 |

> 0043 (rascunho) e 0045 (IA) são de features anteriores; o check também as
> reporta para completude.
