# Tetris Game

A responsive Tetris-style browser game built with HTML Canvas, CSS, and vanilla JavaScript. No framework or build step is required.

## Features

- Seven-bag random piece generator
- Hold piece and three-piece preview
- Ghost piece and hard drop
- Scoring, line count, levels, and increasing speed
- High score saved in the browser with `localStorage`
- Keyboard and mobile touch controls
- Automatic pause when the browser tab becomes hidden
- Responsive layout for desktop and mobile

## Controls

| Action | Keyboard |
| --- | --- |
| Move left / right | `←` / `→` |
| Soft drop | `↓` |
| Rotate clockwise | `↑` or `X` |
| Rotate counterclockwise | `Z` |
| Hard drop | `Space` |
| Hold piece | `C` |
| Pause / resume | `P` or `Esc` |
| Restart | `R` |

## Run locally

Open `index.html` directly in a browser, or serve the folder locally:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Publish with GitHub Pages

1. Open the repository **Settings**.
2. Select **Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the `main` branch and `/ (root)` folder.
5. Save the settings.

The site will be published at:

`https://saratchai1.github.io/tetris-game/`

## Project structure

```text
.
├── index.html
├── styles.css
├── game.js
└── README.md
```

## License

This project is provided for learning and personal use. It uses no external game assets or libraries.
