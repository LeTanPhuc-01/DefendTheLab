import { createAppClient } from 'webtouch-sdk';

// Initialize the WebTouch Client
const client = createAppClient();

// --- 1. Connection & Room Logic ---
client.onConnected(() => {
    console.log("✅ Connected to WebTouch Hub");
    // Automatically create a room when connected
    client.registerNewRoom();
});

client.onRoomId((roomId) => {
    console.log("🏠 Room Created:", roomId);
    updateConnectionUI(roomId);
});

// --- 2. UI Updates (QR & Room Code) ---
function updateConnectionUI(roomId) {
    // Update the text display
    const roomText = document.getElementById('roomCodeText');
    if (roomText) roomText.innerText = roomId;

    // Generate the Join URL
    const port = window.location.port ? `:${window.location.port}` : '';
    const controllerUrl = `${window.location.protocol}//${window.location.hostname}${port}/controller`;
    const fullJoinUrl = `${controllerUrl}?room=${roomId}`;

    // Update QR Code
    const qrImg = document.getElementById('qrImage');
    if (qrImg) {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(fullJoinUrl)}`;
    }
}

// --- 3. Game Input Handling ---

// Cursor State
let cursorX = window.innerWidth / 2;
let cursorY = window.innerHeight / 2;
const SENSITIVITY = 2.0;

// Listen for standard cursor events from the SDK
client.onCursorMove((payload) => {
    // Update state based on delta
    if (payload.deltaX !== undefined || payload.deltaY !== undefined) {
        cursorX += (payload.deltaX || 0) * SENSITIVITY;
        cursorY += (payload.deltaY || 0) * SENSITIVITY;
    }
    // Fallback for absolute positioning (if used in future)
    else if (payload.x !== undefined && payload.y !== undefined) {
        cursorX = payload.x * window.innerWidth;
        cursorY = payload.y * window.innerHeight;
    }

    // Clamp to screen bounds
    cursorX = Math.max(0, Math.min(window.innerWidth, cursorX));
    cursorY = Math.max(0, Math.min(window.innerHeight, cursorY));

    // Update the visual cursor element
    const cursorEl = document.getElementById('cursor');
    if (cursorEl) {
        // Ensure cursor is visible
        if (!cursorEl.classList.contains('active')) {
            cursorEl.classList.add('active');
        }

        cursorEl.style.left = `${cursorX}px`;
        cursorEl.style.top = `${cursorY}px`;
    }

    // Forward to Phaser if the game is running
    if (window.game) {
        const worldScene = window.game.scene.getScene('world');
        if (worldScene?.sys?.settings?.active && worldScene.updateCursorPosition) {
            worldScene.updateCursorPosition(cursorX, cursorY);
        }
    }
});

client.onTap((payload) => {
    // Visual feedback for tap
    const cursorEl = document.getElementById('cursor');
    if (cursorEl) {
        cursorEl.classList.add('clicking');
        setTimeout(() => cursorEl.classList.remove('clicking'), 150);
    }

    // --- Simulate DOM Click ---
    // Temporarily hide the cursor to ensure elementFromPoint hits the element below
    let prevDisplay = '';
    if (cursorEl) {
        prevDisplay = cursorEl.style.display;
        cursorEl.style.display = 'none';
    }

    const target = document.elementFromPoint(cursorX, cursorY);

    // Restore cursor
    if (cursorEl) {
        cursorEl.style.display = prevDisplay;
    } console.log("Tap at", cursorX, cursorY, "Target:", target); // DEBUG LOG

    if (target) {
        // Handle focus for inputs explicitly
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
            target.focus();
        }

        // Dispatch a full sequence of mouse events to ensure compatibility
        const eventOptions = {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: cursorX,
            clientY: cursorY
        };

        target.dispatchEvent(new MouseEvent('mousedown', eventOptions));
        target.dispatchEvent(new MouseEvent('mouseup', eventOptions));
        target.dispatchEvent(new MouseEvent('click', eventOptions));
    }

    // Forward tap/click to Phaser
    if (window.game) {
        const worldScene = window.game.scene.getScene('world');
        if (worldScene?.sys?.settings?.active && worldScene.handleTap) {
            worldScene.handleTap();
        }
    }
});

// Listen for keyboard events from the controller
client.onKeyPress((payload) => {
    const activeElement = document.activeElement;
    if (!activeElement || (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA')) return;

    const key = payload.key;

    if (key === 'Backspace') {
        activeElement.value = activeElement.value.slice(0, -1);
        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (key === 'Enter') {
        // Dispatch Enter key event
        const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            bubbles: true
        });
        activeElement.dispatchEvent(enterEvent);

        // Also try to find the submit button
        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) submitBtn.click();
    } else if (key.length === 1) {
        // Append character
        activeElement.value += key;
        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
});

// Listen for special buttons (gamepad buttons, etc.)
client.onButton((payload) => {
    // ... existing logic if needed for other buttons ...
});

// Listen for custom events (like OCR results)
client.onCustomEvent((eventName, payload, controllerId) => {
    if (eventName === 'digit_recognized') {
        console.log("Received recognized digit from controller:", payload.digit);

        if (window.game) {
            const worldScene = window.game.scene.getScene('world');
            // Check if the scene is active and has the method
            if (worldScene && worldScene.sys.settings.active && worldScene.checkEnemies) {
                // Note: WorldScene.js uses checkEnemies, not checkVirus
                worldScene.checkEnemies(payload.digit.toString(), payload.confidence);
            }
        }
    }
});

// Track current mode to sync with new controllers
let currentControllerMode = 'MENU';

// Listen for new controllers joining
client.onControllerJoined((payload) => {
    const controllerId = payload.controllerId || payload;
    console.log("🎮 Controller Joined:", controllerId);

    // Sync the current mode to the new controller
    if (client.sendEventToController) {
        console.log(`Syncing mode ${currentControllerMode} to ${controllerId}`);
        client.sendEventToController(controllerId, {
            eventName: 'set_controller_mode',
            payload: { mode: currentControllerMode }
        });
    }
});

// Expose controller mode switcher for the game to use
window.setControllerMode = (mode) => {
    console.log("Requesting controller mode:", mode);
    currentControllerMode = mode; // Update local state

    // Use sendEventToControllers for the App Client
    if (client.sendEventToControllers) {
        console.log("Sending event to controllers...", client.socket.connected ? "(Connected)" : "(DISCONNECTED!)");
        client.sendEventToControllers({ eventName: 'set_controller_mode', payload: { mode } });
    } else {
        console.error("client.sendEventToControllers is not defined. Check SDK version.");
    }
};
