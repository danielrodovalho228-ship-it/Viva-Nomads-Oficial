# E274 — a foto do anúncio no e-mail proativo: diagnóstico e prova (01/11/2026)

**Pergunta:** a prova visual de 01/11 viu o e-mail "Surgiu um imóvel que combina com o seu pedido" (inquilino2,
enviado às 08:00) sem foto e sem botão. A área da foto mostrava "Imagem: transacional.jpg" e a URL da foto impressa
como texto.

**Conclusão:** o e-mail **saiu com a foto e com o botão**. O que a prova leu foi o **texto puro** guardado na caixa de
teste, e o texto puro de qualquer e-mail não tem imagem nem botão. Não houve defeito no modelo nem no envio, e não há
correção de código.

## 1. O modelo no repositório
- Cada cartão de imóvel do e-mail proativo (`cartaoImovel`, `src/lib/notifications/cartoes-email.ts`) é uma tabela
  `data-cartao="imovel"` com, em ordem:
  1. a **foto de capa** do anúncio: `<img>` com a capa do Storage público, servida pelo otimizador do site em 640 px,
     q=75 (corrigido no #1610);
  2. título, bairro e cidade;
  3. "Total por mês (com contas)";
  4. o **botão "Ver o imóvel"**.
- No **texto puro** do mesmo e-mail, o cartão vira três linhas: "• título — bairro, cidade", o total e "Ver o imóvel:
  link". É a versão sem imagem que todo cliente de e-mail recebe junto com o HTML.
- "Imagem: transacional.jpg" é outra coisa: o **cabeçalho** do e-mail (a faixa do topo, igual para todos os e-mails
  desse tipo), não a foto do anúncio.

## 2. O modelo que vale no envio
- Este e-mail **não usa modelo do Supabase**. Os modelos do Supabase (a Action do E336) são só os 6 e-mails de
  conta: código de acesso, cadastro, senha, troca de e-mail, convite e reautenticação.
- O e-mail proativo é montado pelo código do site, no envio: `proativos-servidor.ts` → `notify` → `montarNotificacao`
  → Resend. Ele vale a versão do site no ar no momento do disparo.
- O registro do disparo de 01/11 11:00 UTC (08:00 de Brasília) traz a linha "Foto do cartão: …". Essa linha só existe
  desde o #1682 (31/10 15:10 UTC), então o disparo usou o código com a correção da foto (#1610) e a linha da caixa
  (#1682/#1686).

## 3. O que ficou gravado e o que a caixa mostra
- `emails_teste` tem as colunas `id, criado_em, evento, assunto, corpo, destinatario_mascarado, usuario_id`. **Não há
  HTML guardado:** o `corpo` é o texto puro.
- Para a foto poder ser conferida mesmo assim (#1682), o envio grava no topo do corpo a URL da foto de cada cartão, lida
  do `<img>` do **HTML que foi enviado** (`fotosDosCartoes(params.html)` em `email.ts`). O registro de 01/11 traz:
  `Foto do cartão: https://vivanomads.com.br/_next/image?url=…bcc6ad2b-efe6-497d-af45-885f854e3ddf.webp&w=640&q=75`.
  Essa linha **é a prova de que o HTML enviado tinha a foto**: se não houvesse `<img>` no cartão, ela não existiria.
- A tela da caixa (/admin/emails-teste e /dashboard/qa/emails, `ListaEmailsTeste`) mostra essa foto **como imagem**,
  acima do texto, ao abrir "Ler o e-mail" (`FotosDoCartao`). Quem lê a linha direto no banco vê só a URL em texto.
- A URL da foto responde em produção: HTTP 200, `image/jpeg`, 28.713 bytes (conferido em 01/11).
- Conferido com o código atual: o corpo gravado em 01/11, passado pela mesma função da tela (`linhaParaTela` →
  `fotosNoCorpo`), devolve essa URL como foto.

## 4. Onde a foto se prova de verdade
1. **Na caixa real da conta de teste (prova definitiva).** O e-mail foi aceito pelo Resend e entregue a
   `inquilino2@vivanomads.com.br`. Quem tem acesso a essa caixa abre o e-mail de 01/11 08:00 e vê a foto, o título, o
   total e o botão "Ver o imóvel". O painel do Resend também mostra a prévia do HTML enviado.
2. **Na tela da caixa de teste**, logado como admin ou como QA: "Ler o e-mail" mostra a foto acima do texto. Ler o
   banco direto não serve, porque lá só há texto.
3. **No HTML reconstruído** (`docs/e274/email-proativo-01-11-reconstruido.html`). É o mesmo código de produção
   (`montarEmailProativo` + `montarNotificacao`) com os dados do envio de 01/11: título, bairro, cidade, total e capa.
   - Aberto num navegador, carrega a foto real do anúncio, na mesma URL do e-mail.
   - O texto puro gerado é idêntico ao gravado na caixa, o que mostra que o caminho é o mesmo.
   - Só a saudação e o link de descadastro trocam o token por um link genérico.

## O que não muda
- A caixa de teste continua guardando só texto. Guardar o HTML inteiro traria links com token e mais dado por e-mail,
  o que é assunto de retenção (E293). Isso fica para decisão, não para este registro.
