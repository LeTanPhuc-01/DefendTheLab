// public/js/controllerMain.js

import { createControllerClient } from "webtouch-sdk";

const client = createControllerClient();

// DOM refs
const manualJoinForm = document.getElementById("manualJoinForm");
const manualRoomInput = document.getElementById("manualRoomIdInput");
const joinManualButton = document.getElementById("joinManualButton");
const controllerUiWrapper = document.getElementById("controllerUiWrapper");
const touchSurface = document.getElementById("touchSurface");
const inventorySection = document.getElementById("inventorySection");
const fixedActionButtons = document.getElementById("fixedActionButtons");
const actionVerbButtons = fixedActionButtons.querySelectorAll(
  ".action-verb-button"
);
const statusMessage = document.getElementById("statusMessage");

// State
let targetRoomCode = null;
const activePointers = new Map();
let selectedInventoryItemId = null;
let currentActionVerb = null;
let lastKnownInventory = [];
let currentHoverActions = [];

// Join UI

function showControllerUI(roomCode) {
  manualJoinForm.style.display = "none";
  controllerUiWrapper.style.display = "flex";
  targetRoomCode = roomCode;
  statusMessage.textContent = `Joining Room: ${roomCode}...`;
  statusMessage.className = "statusMessage";
}

function showManualJoinUI(msg = "Enter the 4-letter Room Code.") {
  manualJoinForm.style.display = "block";
  controllerUiWrapper.style.display = "none";
  statusMessage.textContent = msg;
  statusMessage.className = "statusMessage error";
  targetRoomCode = null;
}

function attemptToJoinRoom(roomCode) {
  const upper = (roomCode || "").toUpperCase();
  if (upper.length !== 4) {
    showManualJoinUI("Invalid code.");
    return;
  }
  showControllerUI(upper);
  client.joinRoom(upper);
}

// Lifecycle hooks

client.onConnected(() => {
  statusMessage.textContent = "Connected. Waiting for Room...";
  statusMessage.className = "statusMessage";

  const fromUrl = new URLSearchParams(location.search).get("room");
  if (fromUrl) attemptToJoinRoom(fromUrl);
  else showManualJoinUI();
});

client.onDisconnected((reason) => {
  activePointers.clear();
  showManualJoinUI(`Disconnected: ${reason || "Lost connection"}`);
});

client.onJoinSuccess((roomId) => {
  statusMessage.textContent = `Connected: Room ${roomId}`;
  statusMessage.className = "statusMessage connected";
});

client.onInvalidRoom((roomId) => {
  showManualJoinUI(`Error: Invalid Room "${roomId}"`);
});

client.onAppDisconnected(() => {
  showManualJoinUI("Game Closed.");
});

client.onAppReconnected(() => {
  if (targetRoomCode) {
    statusMessage.textContent = `Reconnected: Room ${targetRoomCode}`;
    statusMessage.className = "statusMessage connected";
  }
});

// Pointer → cursor movement

touchSurface.addEventListener("pointerdown", (e) => {
  if (!targetRoomCode || e.button !== 0) return;
  e.preventDefault();
  try {
    touchSurface.setPointerCapture(e.pointerId);
  } catch {}
  activePointers.set(e.pointerId, {
    startTime: Date.now(),
    startX: e.clientX,
    startY: e.clientY,
    prevX: e.clientX,
    prevY: e.clientY,
  });
});

touchSurface.addEventListener("pointermove", (e) => {
  const state = activePointers.get(e.pointerId);
  if (!targetRoomCode || !state) return;
  e.preventDefault();
  const deltaX = e.clientX - state.prevX;
  const deltaY = e.clientY - state.prevY;
  if (deltaX || deltaY) {
    client.sendCursorMove({ deltaX, deltaY });
  }
  state.prevX = e.clientX;
  state.prevY = e.clientY;
});

function handlePointerEnd(e) {
  const state = activePointers.get(e.pointerId);
  if (!targetRoomCode || !state) return;
  const duration = Date.now() - state.startTime;
  const dx = e.clientX - state.startX;
  const dy = e.clientY - state.startY;
  const distSq = dx * dx + dy * dy;

  try {
    if (touchSurface.hasPointerCapture(e.pointerId)) {
      touchSurface.releasePointerCapture(e.pointerId);
    }
  } catch {}
  activePointers.delete(e.pointerId);

  // Tap detection
  if (duration < 300 && distSq < 15 * 15) {
    const actionVerb = currentActionVerb || null;
    client.sendTap({
      actionVerb,
      selectedItemId: selectedInventoryItemId,
    });
  }
}

touchSurface.addEventListener("pointerup", handlePointerEnd);
touchSurface.addEventListener("pointercancel", handlePointerEnd);

// Inventory rendering + selection

function renderInventory(inventory) {
  lastKnownInventory = Array.isArray(inventory) ? inventory : [];
  inventorySection.innerHTML = "";

  if (lastKnownInventory.length === 0) {
    inventorySection.innerHTML =
      '<div class="empty-inventory-text">Inventory empty</div>';
    return;
  }

  lastKnownInventory.forEach((item) => {
    if (!item || !item.itemId || !item.name) return;

    const itemDiv = document.createElement("div");
    itemDiv.classList.add("inventory-item");
    itemDiv.dataset.itemId = item.itemId;
    itemDiv.title = `${item.name}${
      item.description ? "\n" + item.description : ""
    }`;

    if (item.itemId === selectedInventoryItemId) {
      itemDiv.classList.add("selected");
    }

    const emojiSpan = document.createElement("div");
    emojiSpan.classList.add("item-emoji");
    emojiSpan.textContent = item.emoji || "❓";
    itemDiv.appendChild(emojiSpan);

    const nameSpan = document.createElement("span");
    nameSpan.classList.add("item-name");
    nameSpan.textContent = item.name;
    itemDiv.appendChild(nameSpan);

    // Click to select/deselect
    itemDiv.addEventListener("click", () => {
      if (!targetRoomCode) return;
      const clickedId = item.itemId;
      const newSelected =
        selectedInventoryItemId === clickedId ? null : clickedId;
      selectedInventoryItemId = newSelected;
      renderInventory(lastKnownInventory);

      client.sendCustomEvent({
        eventName: "adventure_select_inventory_item",
        payload: { itemId: selectedInventoryItemId },
      });
    });

    // Long press for description
    let pressTimer = null;
    let holding = false;

    itemDiv.addEventListener("pointerdown", (e) => {
      if (!e.isPrimary) return;
      holding = false;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        if (!targetRoomCode || activePointers.has(e.pointerId)) return;
        holding = true;
        client.sendCustomEvent({
          eventName: "adventure_request_item_description",
          payload: { itemId: item.itemId },
        });
      }, 600);
    });

    const clearPressTimer = () => {
      clearTimeout(pressTimer);
    };
    itemDiv.addEventListener("pointerup", clearPressTimer);
    itemDiv.addEventListener("pointerleave", clearPressTimer);

    inventorySection.appendChild(itemDiv);
  });
}

// Verbs

function updateActionVerbsEnabled(availableActions) {
  currentHoverActions = Array.isArray(availableActions)
    ? availableActions
    : [];
  actionVerbButtons.forEach((btn) => {
    const verb = btn.dataset.verb;
    const enabled = currentHoverActions.includes(verb);
    btn.disabled = !enabled;
  });
}

fixedActionButtons.addEventListener("click", (e) => {
  const button = e.target.closest(".action-verb-button");
  if (!button || button.disabled) return;
  const verb = button.dataset.verb;
  currentActionVerb = currentActionVerb === verb ? null : verb;
  actionVerbButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.verb === currentActionVerb);
  });
});

// App → controller via app events

client.onAppEvent((eventName, payload) => {
  switch (eventName) {
    case "adventure_ui_state": {
      const { hoverInfo, inventory, activeInventoryItem } = payload || {};
      renderInventory(inventory || []);
      selectedInventoryItemId = activeInventoryItem || null;
      updateActionVerbsEnabled(hoverInfo?.availableActions || []);
      break;
    }
    case "adventure_description": {
      // For now, just use alert or you can add a description element
      const text = (payload && payload.text) || "";
      if (text) {
        // You might create a dedicated overlay DIV for this
        console.log("[Controller] Description:", text);
      }
      break;
    }
    default:
      break;
  }
});

// Manual join form

manualRoomInput.addEventListener("input", (e) => {
  const start = e.target.selectionStart;
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
  e.target.setSelectionRange(start, start);
});

joinManualButton.addEventListener("click", () => {
  const code = manualRoomInput.value.trim();
  if (code.length === 4) attemptToJoinRoom(code);
  else showManualJoinUI("Please enter a valid 4-letter Room Code.");
});

manualRoomInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    joinManualButton.click();
  }
});
