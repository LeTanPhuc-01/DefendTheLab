// public/js/appMain.js

import { createAppClient } from "webtouch-sdk";
import { PhaserPointClickGame } from "./game/PhaserPointClickGame.js";

const SESSION_STORAGE_KEY = "phaserAdventureVerbCtrl";
const qrCodeContainer = document.getElementById("qrCodeContainer");
const statusTextElement = document.getElementById("statusText");
const feedbackTextElement = document.getElementById("feedbackText");

// --- Status / feedback helpers (also used by Phaser scene via window) ---
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

export function showFeedback(text, duration = 3000) {
  feedbackTextElement.textContent = text;
  feedbackTextElement.style.display = "block";
  if (duration > 0) {
    setTimeout(() => {
      feedbackTextElement.style.display = "none";
    }, duration);
  }
}
export function hideFeedback() {
  feedbackTextElement.style.display = "none";
}

// Expose to Phaser scene
window.showStatus = showStatus;
window.hideStatus = hideStatus;
window.showFeedback = showFeedback;
window.hideFeedback = hideFeedback;

// --- QR code rendering ---
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
        console.error("QR Code Generation Error:", err);
        qrCodeContainer.innerHTML +=
          '<p style="color: red;">QR Error.</p>';
      } else {
        qrCodeContainer.appendChild(canvas);
      }
    }
  );
}

// --- Instantiate Phaser wrapper ---
const client = createAppClient();
const game = new PhaserPointClickGame({
  parentId: "game-container",

  // Called whenever hover / inventory / active item state changes
  onUiStateChange: (state) => {
    client.sendEventToControllers({
      eventName: "adventure_ui_state",
      payload: state,
    });
  },

  // Called whenever the game wants controllers to show a description
  onDescriptionChange: (text) => {
    client.sendEventToControllers({
      eventName: "adventure_description",
      payload: { text },
    });
  },
});

// --- WebTouch lifecycle wiring ---

client.onConnected(() => {
  showStatus("Connected. Checking room...", 0);
  const prev = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (prev) {
    client.rejoinRoom(prev);
  } else {
    client.registerNewRoom();
  }
});

client.onRoomId((roomId) => {
  const code = roomId.toUpperCase();
  sessionStorage.setItem(SESSION_STORAGE_KEY, code);
  renderControllerQRCode(code);
  hideStatus();
  game.start();
});

client.onRejoinFailed((roomId) => {
  console.warn("Rejoin failed", roomId);
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  showStatus("Rejoin failed. Creating new room...", 2000);
  client.registerNewRoom();
});

client.onDisconnected((reason) => {
  console.log("App disconnected:", reason);
  showStatus(`Disconnected: ${reason}`, 0);
  qrCodeContainer.innerHTML = '<p style="color:red;">Offline</p>';
  game.pause();
});

client.onControllerPresenceChanged(({ controllerCount }) => {
  game.controllerCountChanged(controllerCount);
});

// --- Controller input → game logic ---

client.onCursorMove(({ deltaX, deltaY }, controllerId) => {
  // Shared cursor: we ignore controllerId and treat it as a single pointer.
  game.cursorMove(deltaX, deltaY);
});

client.onTap(({ actionVerb, selectedItemId }, controllerId) => {
  game.tap(controllerId, { actionVerb, selectedItemId });
});

// --- Custom events from controller (inventory selection, description requests) ---

client.onCustomEvent((eventName, payload, controllerId) => {
  switch (eventName) {
    case "adventure_select_inventory_item":
      game.controllerSelectedItem?.(controllerId, payload.itemId);
      break;
    case "adventure_request_item_description":
      game.controllerRequestedDescription?.(controllerId, payload.itemId);
      break;
    default:
      break;
  }
});

// Initial status
showStatus("Connecting...", 0);
