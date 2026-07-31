# RepositGeometry

Protótipo HTML gratuito, mobile-first e offline de um jogo individual inspirado em Geometry Dash.


## Não apareceu nada no GitHub?

Leia o guia [`PUBLICAR_NO_GITHUB.md`](PUBLICAR_NO_GITHUB.md). Ele explica, pelo celular, como fazer os arquivos aparecerem no GitHub, como mesclar o PR ou criar os arquivos manualmente se o PR não estiver visível.

## Quero testar sem PC e sem dinheiro

Você pode usar só o celular e o GitHub Pages gratuito:

1. Abra este repositório no app ou site do GitHub pelo celular.
2. Entre em **Settings** → **Pages**.
3. Em **Build and deployment**, selecione **Deploy from a branch**.
4. Escolha a branch com estes arquivos e a pasta `/root`.
5. Salve e aguarde o GitHub mostrar o link do Pages.
6. Abra o link no navegador do celular e toque em **Jogar**.
7. Se quiser abrir como app, use a opção do navegador **Adicionar à tela inicial**.

> Se você abrir o arquivo baixado diretamente no celular, o jogo ainda tem uma fase de fallback embutida. Pelo GitHub Pages, ele também consegue ler `data/stages.json` como dado do próprio diretório.

## Como testar com servidor local, se algum dia tiver acesso

```bash
python3 -m http.server 8000
```

Depois abra `http://localhost:8000` no navegador.

## Estrutura

- `index.html`: tela principal, canvas, HUD e botões.
- `styles.css`: visual neon responsivo para celular.
- `game.js`: loop do jogo, física, colisão, geração procedural e registro offline/PWA.
- `data/stages.json`: dados da fase carregados do próprio diretório do GitHub/GitHub Pages.
- `manifest.webmanifest`: configuração para instalar como app pelo navegador.
- `sw.js`: cache simples para funcionar offline depois do primeiro carregamento via Pages.
- `icon.svg`: ícone do app.

## Base para o futuro multiplayer

A geração de obstáculos usa seed e índice de batida simulada. Isso permite que, futuramente, dois jogadores recebam os mesmos obstáculos em faixas diferentes, desde que usem a mesma seed, BPM e lógica de geração.
