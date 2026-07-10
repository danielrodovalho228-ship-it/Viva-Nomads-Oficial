# Prompts de imagem dos e-mails (Higgsfield / IA)

Gere **imagens originais** (não reaproveitar fotos do site) e suba em
`public/media/email/` com **exatamente** os nomes de arquivo abaixo. O sistema
já aponta para esses arquivos — assim que subirem, aparecem nos e-mails sem
mudar código.

## Especificação técnica (vale para todas)

- **Proporção:** paisagem **3:1** (ex.: gerar 1500×500). No e-mail elas aparecem
  como faixa de topo (600×200), então composições **simples e horizontais**
  funcionam melhor. Se o gerador não fizer 3:1, gere 16:9 (1600×900) que eu
  recorto.
- **Formato do arquivo:** **JPG** (o Outlook não lê webp). Qualidade ~80.
- **Sem texto, sem logotipos, sem marca d'água** na imagem.
- **Nada de rostos identificáveis famosos**; pessoas comuns, naturais.

## Estilo (cole junto de cada prompt — mantém consistência entre os 11)

> Photorealistic editorial photograph, warm natural morning light, modern
> Brazilian furnished mid-term rental aesthetic, clean and airy interiors with
> plants and wood accents, shallow depth of field, calm trustworthy and
> optimistic mood, subtle blue (#143C8C) and green (#6CBE2A) accents in the
> scene, horizontal 3:1 composition with clear negative space, no text, no
> logos, no watermark.

---

## Os 11 prompts (arquivo → assunto → prompt)

### 1. `novo-interessado.jpg` — "Novo interessado no seu imóvel"
> A relaxed young professional smiling while looking at a smartphone, sitting by
> a large window of a bright modern furnished apartment, city skyline softly
> blurred outside, a cup of coffee and a small plant on the table, feeling of a
> pleasant surprise / good news. [ + estilo acima ]

### 2. `nova-mensagem.jpg` — "Você tem uma nova mensagem"
> A person smiling warmly while reading a message on a laptop during a friendly
> video-style conversation, cozy living room in soft focus, natural light,
> feeling of open and friendly communication. [ + estilo acima ]

### 3. `candidatura-recebida.jpg` — "Candidatura recebida"
> A calm professional reviewing a document / ID verification on a tablet at a
> tidy desk, subtle checkmark feeling of approval and trust, organized modern
> workspace, reassuring mood. [ + estilo acima ]

### 4. `pedido-resposta.jpg` — "Um proprietário respondeu ao seu pedido"
> Two friendly people shaking hands warmly in a bright furnished living room,
> keys visible on a table nearby, feeling of a good match and agreement, hopeful
> and welcoming. [ + estilo acima ]

### 5. `confirmar-cadastro.jpg` — "Confirme seu e-mail" (boas-vindas)
> A person arriving at a beautiful furnished apartment with a small suitcase,
> opening the door to warm sunlight, sense of a fresh start and welcome, plants
> and cozy decor. [ + estilo acima ]

### 6. `redefinir-senha.jpg` — "Redefinir sua senha" (segurança)
> A serene, secure modern apartment building facade at golden hour, or a calm
> abstract concept of a soft glowing shield/lock over a blurred cozy home
> interior, feeling of safety and protection, minimal and reassuring. [ + estilo acima ]

### 7. `link-de-acesso.jpg` — "Seu link de acesso"
> A close warm shot of a hand holding modern keys in front of an apartment door
> bathed in soft light, feeling of easy secure entry, welcoming threshold. [ + estilo acima ]

### 8. `convite.jpg` — "Você foi convidado"
> An inviting, freshly styled furnished living room with an open door and warm
> light spilling in, a welcoming atmosphere as if inviting someone in, plants
> and comfortable sofa. [ + estilo acima ]

### 9. `trocar-email.jpg` — "Confirme seu novo e-mail"
> A tidy home-office corner with a laptop showing a clean settings-like calm
> screen (no readable text), soft daylight, feeling of updating and confirming
> account details, orderly and trustworthy. [ + estilo acima ]

### 10. `reautenticacao.jpg` — "Seu código de verificação" (OTP/segurança)
> A minimal reassuring security concept: a soft glowing shield or a phone
> displaying a subtle verification screen (no readable text) on a clean surface
> with warm light and a blurred cozy home behind, feeling of safe verification. [ + estilo acima ]

### 11. `transacional.jpg` — modelo base / imóvel
> A stunning modern Brazilian furnished apartment interior for mid-term stay,
> warm inviting light, tasteful decor with plants and wood, large windows,
> aspirational but comfortable, no people. [ + estilo acima ]

---

## Como subir

1. Gere cada imagem, exporte como **JPG**.
2. Renomeie exatamente como a lista (ex.: `novo-interessado.jpg`).
3. Suba para `public/media/email/` no GitHub (substituindo as atuais).
4. Redeploy na Vercel → rode a URL de teste → as novas imagens aparecem.

> Dica: se preferir, me mande os arquivos aqui que eu otimizo (recorto 3:1,
> comprimo) e faço o commit por você.
