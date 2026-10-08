<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Migrações (Viva Nomads)

Toda migração nova vem com `supabase/producao/aplicar-NNNN.sql` idempotente, entre `begin;`/`commit;`, que se registra em `supabase_migrations.schema_migrations` com o nome `NNNN_nome`. Ao mesclar na `main`, a Action "Aplicar migrações em produção" aplica sozinha o que ainda não está registrado: o merge do Daniel é a aprovação. Detalhes em CONTRIBUTING.md.
