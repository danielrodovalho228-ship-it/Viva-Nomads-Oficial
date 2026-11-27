# E790 — o servidor expunha o contato da outra parte depois do aceite (regra E445)

**Regra (E445):** contato (telefone, e-mail, redes) nunca é trocado nem revelado, em nenhuma fase; a conversa segue pelas mensagens da Viva; emergência é pelo telefone da Viva. O E774 corrigiu só os textos.

## Onde o contato saía, na origem
1. **Pedido de parceiro** (`src/lib/parceiros/pedido-actions.ts`, `contatoDaOutraParte`, L2-B item 16): a partir do aceite do orçamento, o servidor lia `profiles.email/phone` e `parceiros.telefone` da OUTRA parte e mandava à tela do pedido, que mostrava "Telefone" (`tel:`) e "E-mail" (`mailto:`). **Removido**: a função, o campo `contato` do detalhe, `contatoNoPedido`/`ContatoDoPedido`. A tela mostra só "O contato não é trocado: a conversa segue pelas mensagens da Viva, antes e depois do aceite."
2. **Fotógrafos** (`src/lib/fotografos/regras.ts`, `contatoLiberado`): regra "contato do dono depois do aceite com taxa paga". Não tinha uso em tela (só no teste), mas deixava a porta pronta. **Removida.**
3. **Banco — `property_private_details` (0052)**: RPC `SECURITY DEFINER` que o `authenticated` pode chamar; devolvia `responsavel_local_nome/telefone/email` também ao **morador com candidatura aceita** (o app só usa a RPC nas telas do dono, mas qualquer morador aceito podia chamá-la com a própria sessão). **Migração 0339**: esses três campos só para o dono e o admin; o morador aceito segue com o endereço exato (não é contato); `draft_data` segue só do dono. Mesma assinatura e grants.

## Varredura (o que fica, e por quê)
- `owner_notify_contact`, `message_notify_contact`, `pedido_owner_recipients`, `pedido_inquilino_recipient`: devolvem e-mail/telefone, mas **só o `service_role` executa** (conferido em produção: `anon` e `authenticated` = sem permissão). Uso: notificar a pessoa no próprio e-mail; nunca vai para a outra parte.
- Leituras de `profiles.phone/email` em `actions.ts`, `perfil-actions.ts`, `canais-actions.ts`, `papeis-actions.ts`: da **própria** conta (`user.id`) ou para notificar o destinatário pelo servidor.
- Telas: nenhum `tel:`/`mailto:` com dado do banco; só o e-mail de suporte da Viva.

## Provas
- **Postgres 16 local** (papéis + a 0339): dono → endereço, nome, telefone, e-mail e draft; morador aceito → **só o endereço** (nome/telefone/e-mail nulos); estranho → 0 linhas.
- **Teste ligado:** `src/lib/parceiros/e790-contato-nunca-revelado.test.ts` (4): o servidor do pedido não lê nem devolve contato; `contatoLiberado` não existe; varredura de `tel:`/`mailto:` com dado do banco nas telas (acusa a tela antiga, conferido); a 0339 só entrega o contato do responsável local ao dono/admin. `contato-recusa.test.ts` e `fotografos/regras.test.ts` ajustados.

## Dúvida
O responsável local (zelador) é contato de um terceiro indicado pelo dono, útil na chegada. Pela regra E445 tratei como contato (não vai ao morador). Se o desenho quiser que o morador o veja na chegada, é decisão de produto e a mudança é só reverter a 0339 (rollback pronto).
