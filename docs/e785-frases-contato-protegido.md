# E785 — gate de frases proibidas: "contato protegido até o aceite" e variantes

**Regra (E445/E764):** telefone, e-mail e redes sociais NUNCA são trocados entre morador e proprietário, nem depois do aceite. "Contato protegido até o aceite" sugere o contrário (que o contato é liberado depois).

**Gate:** nova regra `contato-protegido-ate-o-aceite` em `src/lib/frases-proibidas.ts` — cobre `contato/telefone/e-mail/whatsapp … protegido|oculto|liberado|revelado|compartilhado|trocado … até/antes do aceite` e `protegemos/mantemos/guardamos … contato … até o aceite`; frases que NEGAM ("nunca são trocados… inclusive depois do aceite") passam. A varredura de `supabase/` agora ignora comentário de SQL (`--`): as migrações antigas são imutáveis.

**Superfícies que a regra pegou e foram corrigidas (7):** selo da home → `SELO_SEM_TROCA_DE_CONTATO` ("Sem troca de contato direto"); Como funciona e Preços → `CONTATO_NUNCA_TROCADO` / `FRASE_NEGOCIACAO_NA_PLATAFORMA`; Para proprietários; aviso do anúncio de exemplo (`owner-card`); "Bom saber" (`PROTECOES_VIVA`). Specs ajustados: t217, t172.

**Testes:** `frases-proibidas.test.ts` (+2), `home-imagens.test.ts`; 1.880 testes de `src/lib`, `src/config`, `src/components` verdes; `tsc` limpo. Sem prova ao vivo.
