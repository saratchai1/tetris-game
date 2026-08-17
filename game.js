"use strict";

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const PREVIEW_BLOCK = 24;
const STORAGE_KEY = "tetris-game-high-score";

const PIECES = {
  I: {
    color: "#43d9ff",
    matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  J: {
    color: "#5577ff",
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  L: {
    color: "#ff9f43",
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  O: {
    color: "#ffe66d",
    matrix: [
      [1, 1],
      [1, 1],
    ],
  },
  S: {
    color: "#55e88f",
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
  },
  T: {
    color: "#bd70ff",
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  Z: {
    color: "#ff5d73",
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
  },
};

const SCORE_TABLE = [0, 100, 300, 500, 800];

const canvas = document.querySelector("#game-canvas");
const context = canvas.getContext("2d");
const nextCanvas = document.querySelector("#next-canvas");
const nextContext = nextCanvas.getContext("2d");
const holdCanvas = document.querySelector("#hold-canvas");
const holdContext = holdCanvas.getContext("2d");

const scoreElement = document.querySelector("#score");
const highScoreElement = document.querySelector("#high-score");
const linesElement = document.querySelector("#lines");
const levelElement = document.querySelector("#level");
const overlay = document.querySelector("#overlay");
const overlayKicker = document.querySelector("#overlay-kicker");
const overlayTitle = document.querySelector("#overlay-title");
const overlayMessage = document.querySelector("#overlay-message");
const overlayButton = document.querySelector("#overlay-button");
const startButton = document.querySelector("#start-button");
const pauseButton = document.querySelector("#pause-button");
const restartButton = document.querySelector("#restart-button");
const mobileControls = document.querySelector(".mobile-controls");

let board = createBoard();
let queue = [];
let currentPiece = null;
let heldType = null;
let canHold = true;
let score = 0;
let lines = 0;
let level = 1;
let highScore = loadHighScore();
let state = "idle";
let animationFrameId = null;
let lastTime = 0;
let dropAccumulator = 0;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

function createPiece(type) {
  const definition = PIECES[type];
  const matrix = cloneMatrix(definition.matrix);
  return {
    type,
    matrix,
    color: definition.color,
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: -getTopPadding(matrix),
  };
}

function getTopPadding(matrix) {
  let padding = 0;
  for (const row of matrix) {
    if (row.some(Boolean)) break;
    padding += 1;
  }
  return padding;
}

function shuffle(values) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

function refillQueue() {
  while (queue.length < 7) {
    queue.push(...shuffle(Object.keys(PIECES)));
  }
}

function spawnPiece(forcedType = null) {
  refillQueue();
  currentPiece = createPiece(forcedType ?? queue.shift());
  refillQueue();
  canHold = true;
  drawPreviews();

  if (collides(currentPiece)) {
    finishGame();
  }
}

function collides(piece, offsetX = 0, offsetY = 0, matrix = piece.matrix) {
  for (let row = 0; row < matrix.length; row += 1) {
    for (let column = 0; column < matrix[row].length; column += 1) {
      if (!matrix[row][column]) continue;

      const boardX = piece.x + column + offsetX;
      const boardY = piece.y + row + offsetY;

      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
        return true;
      }

      if (boardY >= 0 && board[boardY][boardX]) {
        return true;
      }
    }
  }
  return false;
}

function mergePiece() {
  let lockedAboveBoard = false;

  currentPiece.matrix.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      if (!cell) return;

      const boardY = currentPiece.y + rowIndex;
      const boardX = currentPiece.x + columnIndex;

      if (boardY < 0) {
        lockedAboveBoard = true;
      } else {
        board[boardY][boardX] = currentPiece.color;
      }
    });
  });

  if (lockedAboveBoard) {
    finishGame();
    return;
  }

  clearCompletedLines();
  spawnPiece();
}

function clearCompletedLines() {
  let cleared = 0;

  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (board[row].every(Boolean)) {
      board.splice(row, 1);
      board.unshift(Array(COLS).fill(null));
      cleared += 1;
      row += 1;
    }
  }

  if (cleared > 0) {
    score += SCORE_TABLE[cleared] * level;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    saveHighScoreIfNeeded();
    updateStats();
  }
}

function movePiece(direction) {
  if (state !== "playing" || !currentPiece) return;
  if (!collides(currentPiece, direction, 0)) {
    currentPiece.x += direction;
    draw();
  }
}

function softDrop(manual = true) {
  if (state !== "playing" || !currentPiece) return false;

  if (!collides(currentPiece, 0, 1)) {
    currentPiece.y += 1;
    if (manual) {
      score += 1;
      saveHighScoreIfNeeded();
      updateStats();
    }
    draw();
    return true;
  }

  mergePiece();
  draw();
  return false;
}

function hardDrop() {
  if (state !== "playing" || !currentPiece) return;

  let distance = 0;
  while (!collides(currentPiece, 0, 1)) {
    currentPiece.y += 1;
    distance += 1;
  }

  score += distance * 2;
  saveHighScoreIfNeeded();
  updateStats();
  mergePiece();
  draw();
}

function rotateMatrix(matrix, direction) {
  const size = matrix.length;
  const rotated = Array.from({ length: size }, () => Array(size).fill(0));

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (direction > 0) {
        rotated[column][size - 1 - row] = matrix[row][column];
      } else {
        rotated[size - 1 - column][row] = matrix[row][column];
      }
    }
  }
  return rotated;
}

function rotatePiece(direction) {
  if (state !== "playing" || !currentPiece || currentPiece.type === "O") return;

  const rotated = rotateMatrix(currentPiece.matrix, direction);
  const kicks = [0, -1, 1, -2, 2];

  for (const kick of kicks) {
    if (!collides(currentPiece, kick, 0, rotated)) {
      currentPiece.matrix = rotated;
      currentPiece.x += kick;
      draw();
      return;
    }
  }

  if (!collides(currentPiece, 0, -1, rotated)) {
    currentPiece.matrix = rotated;
    currentPiece.y -= 1;
    draw();
  }
}

function holdPiece() {
  if (state !== "playing" || !currentPiece || !canHold) return;

  const outgoingType = currentPiece.type;
  canHold = false;

  if (heldType === null) {
    heldType = outgoingType;
    spawnPiece();
  } else {
    const incomingType = heldType;
    heldType = outgoingType;
    currentPiece = createPiece(incomingType);
    drawPreviews();

    if (collides(currentPiece)) {
      finishGame();
    }
  }

  canHold = false;
  draw();
}

function getGhostY() {
  if (!currentPiece) return 0;
  let ghostY = currentPiece.y;
  while (!collides({ ...currentPiece, y: ghostY }, 0, 1)) {
    ghostY += 1;
  }
  return ghostY;
}

function getDropInterval() {
  return Math.max(80, 900 * Math.pow(0.84, level - 1));
}

function gameLoop(time = 0) {
  if (state !== "playing") return;

  const delta = Math.min(time - lastTime, 100);
  lastTime = time;
  dropAccumulator += delta;

  if (dropAccumulator >= getDropInterval()) {
    softDrop(false);
    dropAccumulator = 0;
  }

  draw();
  animationFrameId = requestAnimationFrame(gameLoop);
}

function startGame() {
  if (state === "playing") return;

  if (state === "paused") {
    resumeGame();
    return;
  }

  board = createBoard();
  queue = [];
  currentPiece = null;
  heldType = null;
  canHold = true;
  score = 0;
  lines = 0;
  level = 1;
  state = "playing";
  lastTime = performance.now();
  dropAccumulator = 0;

  spawnPiece();
  updateStats();
  updateButtons();
  hideOverlay();
  cancelAnimationFrame(animationFrameId);
  animationFrameId = requestAnimationFrame(gameLoop);
}

function restartGame() {
  cancelAnimationFrame(animationFrameId);
  state = "idle";
  startGame();
}

function pauseGame() {
  if (state !== "playing") return;
  state = "paused";
  cancelAnimationFrame(animationFrameId);
  updateButtons();
  showOverlay({
    kicker: "GAME PAUSED",
    title: "TAKE A BREATH",
    message: "Press P, Escape, or Resume when you are ready.",
    buttonText: "Resume",
  });
}

function resumeGame() {
  if (state !== "paused") return;
  state = "playing";
  lastTime = performance.now();
  dropAccumulator = 0;
  updateButtons();
  hideOverlay();
  cancelAnimationFrame(animationFrameId);
  animationFrameId = requestAnimationFrame(gameLoop);
}

function togglePause() {
  if (state === "playing") {
    pauseGame();
  } else if (state === "paused") {
    resumeGame();
  }
}

function finishGame() {
  state = "gameover";
  cancelAnimationFrame(animationFrameId);
  saveHighScoreIfNeeded();
  updateStats();
  updateButtons();
  showOverlay({
    kicker: "GAME OVER",
    title: score.toLocaleString(),
    message: `You cleared ${lines} ${lines === 1 ? "line" : "lines"}. Try again and beat your high score.`,
    buttonText: "Play again",
  });
}

function loadHighScore() {
  try {
    const value = Number.parseInt(localStorage.getItem(STORAGE_KEY) ?? "0", 10);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function saveHighScoreIfNeeded() {
  if (score <= highScore) return;
  highScore = score;
  try {
    localStorage.setItem(STORAGE_KEY, String(highScore));
  } catch {
    // The game still works when browser storage is unavailable.
  }
}

function updateStats() {
  scoreElement.textContent = score.toLocaleString();
  highScoreElement.textContent = highScore.toLocaleString();
  linesElement.textContent = String(lines);
  levelElement.textContent = String(level);
}

function updateButtons() {
  startButton.textContent = state === "paused" ? "Resume" : state === "playing" ? "Running" : "Start";
  startButton.disabled = state === "playing";
  pauseButton.disabled = state === "idle" || state === "gameover";
  pauseButton.textContent = state === "paused" ? "Resume" : "Pause";
}

function showOverlay({ kicker, title, message, buttonText }) {
  overlayKicker.textContent = kicker;
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  overlayButton.textContent = buttonText;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function drawBlock(targetContext, x, y, color, size = BLOCK, alpha = 1) {
  const inset = Math.max(1, Math.floor(size * 0.07));
  const radius = Math.max(2, Math.floor(size * 0.16));

  targetContext.save();
  targetContext.globalAlpha = alpha;
  targetContext.fillStyle = color;
  roundedRect(
    targetContext,
    x * size + inset,
    y * size + inset,
    size - inset * 2,
    size - inset * 2,
    radius,
  );
  targetContext.fill();

  const gradient = targetContext.createLinearGradient(
    x * size,
    y * size,
    (x + 1) * size,
    (y + 1) * size,
  );
  gradient.addColorStop(0, "rgba(255,255,255,0.36)");
  gradient.addColorStop(0.42, "rgba(255,255,255,0.02)");
  gradient.addColorStop(1, "rgba(0,0,0,0.2)");
  targetContext.fillStyle = gradient;
  roundedRect(
    targetContext,
    x * size + inset,
    y * size + inset,
    size - inset * 2,
    size - inset * 2,
    radius,
  );
  targetContext.fill();
  targetContext.restore();
}

function roundedRect(targetContext, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  targetContext.beginPath();
  targetContext.moveTo(x + safeRadius, y);
  targetContext.lineTo(x + width - safeRadius, y);
  targetContext.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  targetContext.lineTo(x + width, y + height - safeRadius);
  targetContext.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  targetContext.lineTo(x + safeRadius, y + height);
  targetContext.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  targetContext.lineTo(x, y + safeRadius);
  targetContext.quadraticCurveTo(x, y, x + safeRadius, y);
  targetContext.closePath();
}

function drawGrid() {
  context.strokeStyle = "rgba(255, 255, 255, 0.045)";
  context.lineWidth = 1;

  for (let x = 0; x <= COLS; x += 1) {
    context.beginPath();
    context.moveTo(x * BLOCK + 0.5, 0);
    context.lineTo(x * BLOCK + 0.5, canvas.height);
    context.stroke();
  }

  for (let y = 0; y <= ROWS; y += 1) {
    context.beginPath();
    context.moveTo(0, y * BLOCK + 0.5);
    context.lineTo(canvas.width, y * BLOCK + 0.5);
    context.stroke();
  }
}

function drawBoard() {
  board.forEach((row, y) => {
    row.forEach((color, x) => {
      if (color) drawBlock(context, x, y, color);
    });
  });
}

function drawPiece(piece, targetY = piece.y, alpha = 1) {
  piece.matrix.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      if (!cell) return;
      const y = targetY + rowIndex;
      if (y >= 0) {
        drawBlock(context, piece.x + columnIndex, y, piece.color, BLOCK, alpha);
      }
    });
  });
}

function draw() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#080a12";
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawBoard();

  if (currentPiece && state !== "gameover") {
    const ghostY = getGhostY();
    if (ghostY !== currentPiece.y) {
      drawPiece(currentPiece, ghostY, 0.19);
    }
    drawPiece(currentPiece);
  }
}

function matrixBounds(matrix) {
  let minX = matrix[0].length;
  let maxX = 0;
  let minY = matrix.length;
  let maxY = 0;

  matrix.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (!cell) return;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
  });

  return { minX, maxX, minY, maxY };
}

function drawPreviewPiece(targetContext, type, centerY, blockSize = PREVIEW_BLOCK) {
  const definition = PIECES[type];
  const { matrix, color } = definition;
  const bounds = matrixBounds(matrix);
  const width = (bounds.maxX - bounds.minX + 1) * blockSize;
  const height = (bounds.maxY - bounds.minY + 1) * blockSize;
  const offsetX = (targetContext.canvas.width - width) / 2 - bounds.minX * blockSize;
  const offsetY = centerY - height / 2 - bounds.minY * blockSize;

  matrix.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (!cell) return;
      drawBlock(
        targetContext,
        (offsetX + x * blockSize) / blockSize,
        (offsetY + y * blockSize) / blockSize,
        color,
        blockSize,
      );
    });
  });
}

function drawPreviews() {
  nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  holdContext.clearRect(0, 0, holdCanvas.width, holdCanvas.height);

  nextContext.fillStyle = "rgba(8, 10, 18, 0.68)";
  nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  holdContext.fillStyle = "rgba(8, 10, 18, 0.68)";
  holdContext.fillRect(0, 0, holdCanvas.width, holdCanvas.height);

  queue.slice(0, 3).forEach((type, index) => {
    drawPreviewPiece(nextContext, type, 40 + index * 80, 20);
  });

  if (heldType) {
    drawPreviewPiece(holdContext, heldType, holdCanvas.height / 2, 22);
  }
}

function handleAction(action) {
  const actions = {
    left: () => movePiece(-1),
    right: () => movePiece(1),
    down: () => softDrop(true),
    drop: hardDrop,
    "rotate-left": () => rotatePiece(-1),
    "rotate-right": () => rotatePiece(1),
    hold: holdPiece,
  };
  actions[action]?.();
}

document.addEventListener("keydown", (event) => {
  const handledKeys = [
    "ArrowLeft",
    "ArrowRight",
    "ArrowDown",
    "ArrowUp",
    " ",
    "z",
    "Z",
    "x",
    "X",
    "c",
    "C",
    "p",
    "P",
    "Escape",
    "r",
    "R",
    "Enter",
  ];

  if (handledKeys.includes(event.key)) {
    event.preventDefault();
  }

  if ((event.key === "p" || event.key === "P" || event.key === "Escape") && state !== "idle") {
    togglePause();
    return;
  }

  if ((event.key === "r" || event.key === "R") && state !== "idle") {
    restartGame();
    return;
  }

  if ((event.key === "Enter" || event.key === " ") && (state === "idle" || state === "gameover")) {
    startGame();
    return;
  }

  const keyActions = {
    ArrowLeft: () => movePiece(-1),
    ArrowRight: () => movePiece(1),
    ArrowDown: () => softDrop(true),
    ArrowUp: () => rotatePiece(1),
    x: () => rotatePiece(1),
    X: () => rotatePiece(1),
    z: () => rotatePiece(-1),
    Z: () => rotatePiece(-1),
    " ": hardDrop,
    c: holdPiece,
    C: holdPiece,
  };

  keyActions[event.key]?.();
});

startButton.addEventListener("click", () => {
  if (state === "paused") resumeGame();
  else startGame();
});

pauseButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", restartGame);
overlayButton.addEventListener("click", () => {
  if (state === "paused") resumeGame();
  else startGame();
});

mobileControls.addEventListener("pointerdown", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  event.preventDefault();
  handleAction(button.dataset.action);
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === "playing") {
    pauseGame();
  }
});

updateStats();
updateButtons();
refillQueue();
drawPreviews();
draw();
