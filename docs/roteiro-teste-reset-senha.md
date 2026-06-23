# Roteiro de Teste do Reset de Senha + Checklist de SMTP (Viva Nomads)

## Contexto

A configuração de e-mail transacional do Viva Nomads está quase concluída. O status atual é:

- **Passo 1 (conta de envio com domínio verificado):** ✅ Concluído
- **Passo 2 (SPF e DKIM no DNS):** ✅ Concluído
- **Passo 3 (código do PR #46 — rota `/auth/reset`):** ✅ Mergeado
- **Passo 4 (ligar SMTP no Supabase):** ⏳ Pendente (foco deste roteiro)
- **Passo 5 (Site URL e Redirect URLs no Supabase):** ⏳ Pendente (foco deste roteiro)

O Supabase ainda usa o servidor de teste interno dele para envio de e-mail, por isso nenhum e-mail de reset chega ao usuário. A correção não é de código — basta ligar o SMTP no painel do Supabase e validar as URLs. Siga os dois blocos abaixo.

---

## Bloco 1 — Checklist de Configuração do Supabase (Ação no Painel)

Execute este passo a passo no painel do projeto de produção do Supabase.

### Passo 4 — Ligar o SMTP customizado

1. Acesse `Authentication → Emails → SMTP Settings`.
2. Ative a chave **"Enable Custom SMTP"**.
3. Preencha os campos com as credenciais do seu provedor de e-mail (ex: Resend, SendGrid):
   - **SMTP Host:** (host do provedor)
   - **SMTP Port:** 587 (para TLS) ou 465 (para SSL)
   - **SMTP User:** (usuário do provedor, ex: `resend`)
   - **SMTP Password:** (sua chave de API)
   - **Sender email:** `suporte@vivanomads.com.br` ou `nao-responda@vivanomads.com.br` (precisa ser do domínio já verificado)
   - **Sender name:** `Viva Nomads`
4. Salve as alterações.

> **⚠️ Aviso Importante sobre Credenciais:** Ferramentas como o Resend podem expirar chaves de API após um período de inatividade. Se você gerou a chave no Passo 1 há muito tempo e o envio falhar silenciosamente, gere uma nova chave de API no provedor e atualize o campo `SMTP Password`.

### Passo 5 — Conferir Site URL e Redirect URLs

1. Acesse `Authentication → URL Configuration`.
2. Verifique o campo **Site URL**: deve ser exatamente `https://vivanomads.com.br`.
3. Na seção **Redirect URLs**, adicione a URL: `https://vivanomads.com.br/auth/reset`.
4. Salve as alterações.

> **Por que isso é necessário?** Isso garante que o link gerado no e-mail aponte para a URL de produção correta e que o Supabase aceite a requisição quando o usuário clicar. O fix de código do PR #46 depende dessa rota estar liberada.

---

## Bloco 2 — Roteiro de Teste de Ponta a Ponta (QA)

Após concluir o Bloco 1, execute este roteiro para validar se o reset de senha está funcionando em produção.

### Etapa 1 — Pré-check
- [ ] Confirmar que a URL `/api/health` retorna `"supabase": true`.
- [ ] Confirmar que o SMTP está ativo acessando `Authentication → Logs` no painel do Supabase.

### Etapa 2 — Solicitar o reset
- [ ] Acessar `https://vivanomads.com.br/auth` em uma aba anônima (sem login).
- [ ] Clicar no link "Esqueci minha senha".
- [ ] Inserir o e-mail da conta de teste e enviar.
- [ ] Confirmar que a mensagem de confirmação de envio aparece na tela.
- [ ] Verificar a caixa de entrada do e-mail (e a pasta de spam) aguardando até 2 minutos.
  - *Se o e-mail não chegar:* Abra `Authentication → Logs` no Supabase. Se o registro de envio aparecer lá mas não na caixa de entrada, é problema de entrega ou credencial SMTP. Se não aparecer, a configuração do SMTP (Passo 4) não foi salva corretamente.

### Etapa 3 — Usar o link de reset
- [ ] Abrir o link recebido no e-mail em uma aba anônima.
- [ ] Confirmar que a URL acessada é `https://vivanomads.com.br/auth/reset` (e não uma URL interna do Supabase).
- [ ] Digitar uma nova senha (mínimo de 8 caracteres) e confirmar.
- [ ] Confirmar que o sistema aceita a nova senha e redireciona o usuário para o dashboard ou para a tela de login.

### Etapa 4 — Validar que a senha antiga foi invalidada
- [ ] Tentar fazer login com a senha antiga → deve ser recusado com mensagem de erro.
- [ ] Tentar abrir o mesmo link de reset do e-mail novamente → deve mostrar "link inválido" ou "link expirado".
- [ ] Fazer login com a senha nova → deve entrar normalmente no sistema.

---

## Veredito Final

- 🟢 **GO:** Todas as 4 etapas passaram. O reset de senha está 100% funcional.
- 🟡 **Quase:** O e-mail chega, mas o link redireciona errado ou a senha antiga não foi invalidada (problema de código — abrir issue).
- 🔴 **NO-GO:** O e-mail não chega (verificar a configuração SMTP e a validade das credenciais antes de analisar o código).
