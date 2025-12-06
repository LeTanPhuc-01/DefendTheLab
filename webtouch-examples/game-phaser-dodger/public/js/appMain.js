// public/js/appMain.js

import { createAppClient } from "webtouch-sdk";
import { PhaserDodgerGame } from "./game/PhaserDodgerGame.js";

const SESSION_STORAGE_KEY = "phaserDodgerRoomCodeMP";
const qrCodeContainer = document.getElementById("qrCodeContainer");
const statusTextElement = document.getElementById("statusText");

let assignedRoomCode = null;

// --- Status helpers (used by both WebTouch + GameScene) ---
export function showStatus(text, duration = 3000) {
  statusTextElement.textContent = text;
  statusTextElement.style.display = "block";
  if (duration > 0) {
    setTimeout(() => {
      statusTextElement.style.display = "none";
    }, duration);
  }
}
export function hideStatus() {
  statusTextElement.style.display = "none";
}

// Make them available globally for GameScene (since it still calls them)
window.showStatus = showStatus;
window.hideStatus = hideStatus;

// --- QR code rendering using the roomId from SDK ---
function renderControllerQRCode(roomCode) {
  if (!roomCode) {
    qrCodeContainer.innerHTML = '<p style="color:red;">Waiting...</p>';
    return;
  }
  const controllerUrl = `${window.location.origin}/controller?room=${roomCode}`;
  qrCodeContainer.innerHTML = `<p>${roomCode}</p>`;
  const canvas = document.createElement("canvas");
  QRCode.toCanvas(
    canvas,
    controllerUrl,
    { width: 128, margin: 1, errorCorrectionLevel: "L" },
    (err) => {
      if (err) {
        console.error("[QR] Generation Error:", err);
        qrCodeContainer.innerHTML += '<p style="color: red;">QR Error.</p>';
      } else {
        qrCodeContainer.appendChild(canvas);
      }
    }
  );
}

// Instantiate the Phaser game wrapper
const game = new PhaserDodgerGame({ parentId: "game-container" });

// ---------------------------------------------------------------------------
// WebTouch App Client + per-controller metadata
// ---------------------------------------------------------------------------

const PLAYER_COLORS = [
  0x0000ff,
  0x00ff00,
  0xffff00,
  0xff00ff,
  0x00ffff,
  0xffffff,
];

let nextPlayerNumber = 1;
const playerMeta = new Map(); // controllerId → { playerNumber, color }

function assignPlayerMeta(controllerId) {
  if (playerMeta.has(controllerId)) return playerMeta.get(controllerId);
  const playerNumber = nextPlayerNumber++;
  const color = PLAYER_COLORS[(playerNumber - 1) % PLAYER_COLORS.length];
  const data = { playerNumber, color };
  playerMeta.set(controllerId, data);
  return data;
}

const client = createAppClient();

// --- Connection / room lifecycle ---

client.onConnected(() => {
  showStatus("Connected. Checking for room...", 0);
  const prev = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (prev) {
    client.rejoinRoom(prev);
  } else {
    client.registerNewRoom();
  }
});

client.onRoomId((roomId) => {
  assignedRoomCode = roomId.toUpperCase();
  sessionStorage.setItem(SESSION_STORAGE_KEY, assignedRoomCode);
  renderControllerQRCode(assignedRoomCode);

  game.start(); // start or restart Phaser scene
  hideStatus();
});

client.onRejoinFailed((roomId) => {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  showStatus("Rejoin failed. Creating new room...", 2000);
  client.registerNewRoom();
});

client.onDisconnected((reason) => {
  showStatus(`Disconnected: ${reason}`, 0);
  qrCodeContainer.innerHTML = '<p style="color:red;">Disconnected</p>';
  game.pause();
});

// Optional: presence changes (good for debugging)
client.onControllerPresenceChanged?.((info) => {
});

// --- Controller join/leave ---

client.onControllerJoined((controllerId) => {
  const meta = assignPlayerMeta(controllerId);
  game.controllerJoined(controllerId, meta);
  showStatus(`Player ${meta.playerNumber} joined!`, 2000);
});

client.onControllerDisconnected((controllerId) => {
  game.controllerLeft(controllerId);
});

// --- Controller input → game logic ---

client.onCursorMove(({ deltaX, deltaY }, controllerId) => {
  // Guard in case a move sneaks in before join event
  if (!playerMeta.has(controllerId)) {
    const meta = assignPlayerMeta(controllerId);
    game.controllerJoined(controllerId, meta);
  }
  game.cursorMove(controllerId, deltaX, deltaY);
});

client.onTap(({ source }, controllerId) => {
  if (!playerMeta.has(controllerId)) {
    const meta = assignPlayerMeta(controllerId);
    game.controllerJoined(controllerId, meta);
  }
  game.tap(controllerId, source);
});
