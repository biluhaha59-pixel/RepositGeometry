# Geometry Clash 🎮

Geometry Dash multiplayer com duas faixas e música real.

## Como jogar

| Ação | P1 (faixa de cima) | P2 (faixa de baixo) |
|------|-------------------|---------------------|
| Pular | **Espaço** / Toque Esq | **Enter** / Toque Dir |

- P1 tem **gravidade normal** (pula para cima)
- P2 tem **gravidade invertida** (pula para baixo, fica no teto)
- Toque na metade esquerda da tela = P1 pula
- Toque na metade direita da tela = P2 pula

## Modos
- **vs Bot** – jogue sozinho contra uma IA
- **Local 2P** – dois jogadores no mesmo dispositivo

## Rounds
- **Round 1** – música normal (~2 min)
- **Round 2** – mesma música, mais rápido (+45%), mais obstáculos, dificuldade extrema

## Power-ups
| Ícone | Efeito |
|-------|--------|
| 🛡️ | Escudo – absorve 1 hit |
| ⏱️ | Slow – tudo fica mais lento por 5s |
| 🔄 | Inversão – gravidade invertida por 5s |
| ⭐ | Estrela – invencível por 4s |

## Mecânicas
- **Combo** – colecione power-ups para multiplicar pontos
- **Batidas** – obstáculos gerados em sincronia com as batidas da música
- **Beat Flash** – a tela pulsa com os graves

## Deploy (GitHub Pages)
1. Fork este repositório
2. Vá em Settings → Pages → Source: main / root
3. Jogue no celular pelo navegador
4. Opcional: "Adicionar à Tela Inicial" para instalar como app

## Estrutura
```
index.html        – shell HTML
styles.css        – toda a UI e HUD
game.js           – engine do jogo
audio/gut_genug.mp3 – música inicial
data/stages.json  – configuração de fases
sw.js             – service worker (offline)
```
