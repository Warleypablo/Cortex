# Prompts prontos pra IA de imagem

Use esses prompts em **Midjourney, DALL-E (ChatGPT), Sora/Nano Banana, Ideogram, Flux** ou qualquer gerador de imagem.

**Dica:** gere primeiro o prompt #1 (mestre). Se gostar do resultado, peça as variações usando o #2. Se quiser testar estilos diferentes, use os alternativos no final.

---

## 🎯 Prompt #1 — Mestre (gerar primeiro)

```
Cute chibi cartoon owl mascot, front view, large round head, small compact body, big round expressive eyes behind black square geek glasses (developer style, not aviator), subtle focused eyebrows, soft chest feathers (3-4 simple strokes, not realistic), wearing a small orange bow tie, holding a tiny laptop with one wing, perched calmly.

Style: modern flat illustration with soft shadows, clean thin outline, vector-friendly, similar to Duolingo mascot, Linear app mascot, and Notion illustrations. Simple, readable silhouette that works as a small circular avatar.

Color palette: navy blue body (#1E2A5E), warm beige chest (#F5E6D3), Turbo orange accent (#FF6B1A) on bow tie, mustard yellow beak (#E8A33D), pure black glasses with white highlight.

Personality: nerdy, technical, focused, trustworthy night-shift engineer. Not cutesy-baby, not aggressive sports mascot. Professional but friendly.

Composition: centered, frontal, symmetrical, plain off-white background (#FAF7F2), no text, no logo, square format 1:1.
```

**Configurações sugeridas:**
- Midjourney: adicionar `--ar 1:1 --style raw --v 6.1`
- DALL-E (ChatGPT): pedir "square, 1024x1024, flat illustration style"
- Flux/Ideogram: `aspect ratio 1:1, illustration style`

---

## 🎯 Prompt #2 — Variações (depois de aprovar o mestre)

Substitua a parte em **[COLCHETES]** pela variação desejada e mantenha o resto igual:

```
Same chibi cartoon owl mascot from previous image (navy blue body, beige chest, black square geek glasses, orange bow tie, modern flat illustration style, Duolingo/Linear vibe), now [COLCHETES].

Plain off-white background, centered composition, no text.
```

**Variações pra preencher:**

| # | [COLCHETES] | Uso |
|---|-------------|-----|
| 1 | `giving an enthusiastic thumbs-up with one wing, eyes happy and confident, slight smile` | "Post aprovado" |
| 2 | `looking worried with a small sweat drop on forehead, wings raised in mild alarm, concerned eyes` | "Erro / atenção" |
| 3 | `sleeping peacefully with closed eyes and small "Zzz" symbols floating above, sitting on a branch` | "Fora do horário / idle" |
| 4 | `staring intensely at a laptop screen, glasses reflecting code lines, focused expression, both wings on keyboard` | "Processando / trabalhando" |
| 5 | `holding a clipboard with a checklist, checking off items with a small pencil, satisfied focused look` | "Revisando aprovação" |
| 6 | `celebrating with confetti, both wings raised high, eyes closed in joy, small party hat` | "Milestone / sucesso grande" |

---

## 🔄 Prompts alternativos (testar estilos diferentes)

### Versão A — Mais minimalista (estilo Notion/Linear)
```
Minimal flat illustration of a small navy blue owl mascot wearing black geek glasses and an orange bow tie. Extremely simple shapes, no outlines, soft shadows only. Big round eyes, focused calm expression. Centered, plain cream background. Reference: Notion illustrations, Linear mascots. Square 1:1.
```

### Versão B — Mais fofo (estilo Duolingo)
```
Adorable cartoon owl mascot in Duolingo illustration style, chibi proportions (huge head, tiny body), round black geek glasses, navy blue feathers, cream belly, small orange bow tie, holding a laptop, friendly focused expression. Bright clean colors, smooth gradients, soft outline. White background, centered, 1:1.
```

### Versão C — Mais técnico/sci-fi (estilo robô-coruja)
```
Cyber-owl mascot, fusion of organic owl and friendly robot, navy blue with subtle circuit patterns on feathers, glowing orange accents, square LED-style geek glasses, holding a glowing laptop. Modern flat illustration with subtle tech details. Centered, dark off-white background. Style: modern startup mascot, slightly futuristic but not aggressive. Square 1:1.
```

### Versão D — Estilo sticker (pra WhatsApp/Telegram)
```
Sticker-style owl mascot, thick white outline around the entire character (Telegram/WhatsApp sticker format), navy blue body, big black geek glasses, orange bow tie, chibi proportions, expressive eyes. Transparent background, bold colors, no shadows. Square 1:1.
```

---

## 🛠 Fluxo recomendado

1. **Gera 4 versões do Prompt #1** em paralelo (mesmo prompt, várias seeds)
2. Escolhe a melhor → essa vira a "coruja oficial"
3. **Image-to-image / referência**: usa essa imagem como base e roda as variações do Prompt #2 pedindo "mantém o mesmo personagem, muda só a pose/expressão"
   - Midjourney: usa `--cref` (character reference)
   - DALL-E: anexa a imagem e pede variação
   - Flux: usa IP-Adapter ou referência visual
4. Quando tiver as 6 variações principais, **manda pro designer humano** refinar e vetorizar (ver brief)

## 💡 Dica de prompt
Se o resultado vier "fofo demais" ou "infantil", adiciona ao prompt:
```
...professional and competent expression, not childish, designed for B2B SaaS branding...
```

Se vier "sério demais" ou "monstro":
```
...friendly and approachable, soft rounded shapes, no sharp angles, warm vibe...
```
