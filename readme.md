# WebTouch App Kit

This repo contains the **WebTouch SDK** plus a set of small, focused examples that show how to build rich, dual-screen web experiences:

- A **kiosk / app** running in a desktop browser or on a large display.
- One or more **phone controllers** that connect via a 4-letter room code and control the app in real time.

All examples share the same core pieces:

- A Node.js + Express + Socket.IO server running the **WebTouch hub**.
- A **kiosk app** that uses WebTouch to receive controller input.
- A **controller app** that uses WebTouch to send touch / key / custom events.

---

## Repository Layout

```text
webtouch-app-kit/
├─ webtouch-sdk/               # The reusable SDK package
└─ webtouch-examples/          # Example apps built with the SDK
   ├─ dom-demo-app/            # DOM bridge demo (single & handoff)
   ├─ game-phaser-dodger/      # Multiplayer dodge game with Phaser
   ├─ game-phaser-point-click/ # Phaser adventure with verb/inventory controller
   └─ whiteboard-app/          # Multi-user whiteboard demo
````

Each example is a small, self-contained Node app with its own `package.json`, `server.js`, and `public/` folder.

---

## The WebTouch SDK (core)

The SDK itself lives in `webtouch-sdk/` and is published as a package named `webtouch-sdk`. It provides:

* **Server-side**:

  ```js
  import { attachWebTouchHub } from "webtouch-sdk";

  const io = new Server(httpServer, { /* ... */ });
  attachWebTouchHub(io, { debug: true });
  ```

  `attachWebTouchHub` handles:

  * Room creation (short 4-letter codes)
  * One app + many controllers per room
  * Controller → app events (`controller_event`) with `controllerId`
  * App → controller broadcast/unicast events

* **App-side client** (`createAppClient`):

  ```js
  import { createAppClient } from "webtouch-sdk";

  const client = createAppClient();

  client.onConnected(() => { /* register or rejoin room */ });
  client.onRoomId((roomId) => { /* got assigned/rejoined room */ });

  client.onCursorMove(({ deltaX, deltaY }, controllerId) => { ... });
  client.onTap(({ action, payload }, controllerId) => { ... });
  client.onCustomEvent((name, payload, controllerId) => { ... });

  client.sendEventToControllers({ eventName, payload });
  ```

* **Controller-side client** (`createControllerClient`):

  ```js
  import { createControllerClient } from "webtouch-sdk";

  const client = createControllerClient();

  client.joinRoom("ABCD");
  client.sendCursorMove({ deltaX, deltaY });
  client.sendTap({ actionVerb, selectedItemId });
  client.sendCustomEvent({ eventName: "my_event", payload: {...} });

  client.onAppEvent((eventName, payload) => { /* update controller UI */ });
  ```

* **High-level helpers**:

  * `initWebTouchBridge` – add remote cursor & QR pairing to any existing DOM app.
  * `BaseController` + `TouchpadModule` + `VirtualKeyboardModule` – quickly build mobile controllers with room join, status bar, touchpad, and keyboard.

See `webtouch-sdk/readme.md` for more detail.

---

## Running the Examples

Each example is independent. From the repo root:

```bash
cd webtouch-examples/<example-folder>
npm install
npm start
```

The server prints a banner with URLs like:

```text
🚀 WebTouch Dev Server Running on Port 3000
[vEthernet ...]: http://192.168.x.x:3000/
[Wi-Fi ...]   : http://192.168.y.y:3000/
```

Use the `Wi-Fi` URL from a **desktop browser** for the kiosk app, and the same base URL + `/controller` from your **phone** to join as a controller.

---

## Example 1 – DOM Bridge App (`dom-demo-app/`)

**Path:** `webtouch-examples/dom-demo-app`

This is the simplest “hello world” for WebTouch: it turns a plain HTML form page into a remotely controlled kiosk without changing the form logic.

* **Kiosk app:** `public/app.html`
  A normal page with a text field, textarea, radios, checkboxes, and a “Click Me!” box.

* **Controller:** `public/controller.html`
  Uses `BaseController` + `TouchpadModule` + `VirtualKeyboardModule` to:

  * Join a room with a 4-letter code or QR.
  * Move a remote cursor over the kiosk.
  * Tap to click and focus elements.
  * Type into inputs via a virtual keyboard.

* **Server:** `server.js`

  ```js
  import { attachWebTouchHub } from "webtouch-sdk";
  attachWebTouchHub(io, { debug: true });
  ```

* **App wiring:** `public/js/appMain.js`

  ```js
  import { initWebTouchBridge } from "webtouch-sdk";

  // Regular DOM logic (form submit, click handlers, etc.)

  initWebTouchBridge({
    cursorElement: document.getElementById("cursor"),
    qrCodeContainer: document.getElementById("qrCodeContainer"),
  });
  ```

**What it demonstrates:**

* How to **add WebTouch to an existing app** without changing its logic.
* How the app **reuses room codes** via sessionStorage:

  * Open `/app.html`, pair a controller → room code is stored.
  * Reload or open the app in another tab → the bridge calls `rejoinRoom(previousRoomCode)`.
  * The same controller can seamlessly control the new tab (handoff).

---

## Example 2 – Multi-user Phaser Dodger (`game-phaser-dodger/`)

**Path:** `webtouch-examples/game-phaser-dodger`

A classic “dodge the falling blocks” game where each controller becomes a player square.

* **Kiosk app:** `public/app.html`
  Runs a Phaser 3 game (see `public/js/game/PhaserDodgerGame.js`).

* **Controller:** `public/controller.html`
  Uses `BaseController` + `TouchpadModule` (no keyboard). One tap restarts the game after a hit.

* **Server:** `server.js`
  Uses `attachWebTouchHub` to manage rooms and controllers.

* **App wiring:** `public/js/appMain.js`

  ```js
  import { createAppClient } from "webtouch-sdk";
  import { PhaserDodgerGame } from "./game/PhaserDodgerGame.js";

  const client = createAppClient();
  const game = new PhaserDodgerGame({ parentId: "game-container" });

  client.onRoomId(() => game.start());
  client.onControllerJoined((controllerId) => game.controllerJoined(controllerId, meta));
  client.onControllerDisconnected((controllerId) => game.controllerLeft(controllerId));
  client.onCursorMove(({ deltaX, deltaY }, controllerId) => {
    game.cursorMove(controllerId, deltaX, deltaY);
  });
  client.onTap(({ }, controllerId) => {
    game.tap(controllerId);
  });
  ```

* **Phaser wrapper:** `PhaserDodgerGame.js`
  Encapsulates the Phaser `Game` and `GameScene` so the app doesn’t need to know Phaser APIs directly.

**What it demonstrates:**

* Multi-controller support via `controllerId`.
* How to map WebTouch events into a game engine using a small **adapter class**.
* Using `onControllerJoined` / `onControllerDisconnected` to start/pause the game based on connected controllers.

---

## Example 3 – Phaser Point-and-Click Adventure (`game-phaser-point-click/`)

**Path:** `webtouch-examples/game-phaser-point-click`

A richer demo that shows **bi-directional control**:

* The **kiosk app** is a small adventure game:

  * Player circle in a 2D scene.
  * Virtual cursor controlled by phone.
  * Interactable items (door, orb, key, coin) with `look`, `pickup`, `touch`, `use`, `open`, `talk` actions.
  * An inventory and description text area.

* The **controller** is a custom UI:

  * A big touchpad (cursor control).
  * A scrollable inventory strip with items (emoji + names).
  * A row of verb buttons (`Look`, `Use`, `Touch`, `Open`, `Pick Up`, `Talk`).
  * Buttons enable/disable dynamically based on what the app says is possible at the current hover.

* **Server:** `server.js`
  Uses `attachWebTouchHub` (no game-specific state on the server).

### App wiring: `public/js/appMain.js`

```js
import { createAppClient } from "webtouch-sdk";
import { PhaserPointClickGame } from "./game/PhaserPointClickGame.js";

const client = createAppClient();
const game = new PhaserPointClickGame({
  parentId: "game-container",
  onUiStateChange: (state) => {
    // { hoverInfo, inventory, activeInventoryItem }
    client.sendEventToControllers({
      eventName: "adventure_ui_state",
      payload: state,
    });
  },
  onDescriptionChange: (text) => {
    client.sendEventToControllers({
      eventName: "adventure_description",
      payload: { text },
    });
  },
});

client.onRoomId(() => game.start());
client.onControllerPresenceChanged(({ controllerCount }) => {
  game.controllerCountChanged(controllerCount);
});
client.onCursorMove(({ deltaX, deltaY }) => {
  game.cursorMove(deltaX, deltaY);
});
client.onTap(({ actionVerb, selectedItemId }, controllerId) => {
  game.tap(controllerId, { actionVerb, selectedItemId });
});
client.onCustomEvent((eventName, payload, controllerId) => {
  switch (eventName) {
    case "adventure_select_inventory_item":
      game.controllerSelectedItem(controllerId, payload.itemId);
      break;
    case "adventure_request_inventory_description":
      game.controllerRequestedDescription(controllerId, payload.itemId);
      break;
  }
});
```

### Phaser wrapper + scene: `public/js/game/PhaserPointClickGame.js`

* `PhaserPointClickGame` wraps a Phaser `AdventureScene` and buffers inputs until the scene is ready.
* `AdventureScene` implements:

  * `applyCursorDelta` – moves a shared virtual cursor and detects hovered items.
  * `handleTapFromController` – applies verbs and default movement, interacts with items, updates inventory.
  * `updateControllerStatus` – shows “Waiting for controller…” text.
  * `_emitUiState` – sends `{ hoverInfo, inventory, activeInventoryItem }` back to the app, which forwards it to controllers.
  * `_emitDescription` – notifies controllers about descriptive text.

### Controller wiring: `public/js/controllerMain.js`

```js
import { createControllerClient } from "webtouch-sdk";

const client = createControllerClient();

// join form, status, etc...
client.onConnected(...);
client.onJoinSuccess(...);

touchSurface.addEventListener("pointermove", (e) => {
  // compute deltaX/deltaY
  client.sendCursorMove({ deltaX, deltaY });
});

function renderInventory(inventory) {
  // render items and on click:
  //  - toggle selectedInventoryItemId
  //  - client.sendCustomEvent({
  //       eventName: "adventure_select_inventory_item",
  //       payload: { itemId: selectedInventoryItemId },
  //     });
}

fixedActionButtons.addEventListener("click", (e) => {
  // set currentActionVerb based on clicked verb button
});

client.onAppEvent((eventName, payload) => {
  switch (eventName) {
    case "adventure_ui_state":
      // Update inventory and enabled verbs based on hoverInfo
      break;
    case "adventure_description":
      // Show descriptive text on the controller
      break;
  }
});
```

**What it demonstrates:**

* **App → controller** data flow: app publishes semantic UI state (`hoverInfo`, `inventory`, `activeInventoryItem`) using `sendEventToControllers`.
* **Controller → app** actions: controller sends structured events (`sendTap`, `sendCustomEvent`) instead of raw clicks.
* A more complex UI pattern (verbs + inventory) driven entirely by the app’s semantics.

---

## Example 4 – Multi-user Whiteboard (`whiteboard-app/`)

**Path:** `webtouch-examples/whiteboard-app`

A multi-user drawing app where multiple controllers can draw on a shared whiteboard:

* **Kiosk app:** `public/app.html` + `public/js/app/WhiteboardDemoApp.js`
* **Controller:** `public/controller.html` + `public/js/controller/WhiteboardDemoController.js`
* **App wiring:** `public/js/appMain.js` uses `WebTouchApp` + `WebTouchController` from the SDK for a more structured, MVC-style integration.
* **Server:** `server.js` uses `attachWebTouchHub` just like the other examples.

**What it demonstrates:**

* Multi-user freehand drawing with per-controller cursors.
* Using `WebTouchApp` / `WebTouchController` abstractions to keep controller logic and app logic cleanly separated.
* A more “framework-like” use of the SDK (custom app/controller classes).

See `whiteboard-app/readme.md` for full details.

---

## Learning Path for Students

1. **Start with `dom-demo-app`:**

   * Understand room creation, QR pairing.
   * See how `initWebTouchBridge` can wrap any existing page.

2. **Move to `game-phaser-dodger`:**

   * Learn how to use `createAppClient` and `createControllerClient`.
   * Understand `controllerId` and multi-player wiring.

3. **Study `game-phaser-point-click`:**

   * See how the app can drive controller UI state.
   * Learn to use `sendEventToControllers` and `onAppEvent` with custom `eventName`s.

4. **Explore `whiteboard-app`:**

   * See a more structured architecture with `WebTouchApp` / `WebTouchController`.
   * Think about how to build your own app/controller classes on top of the SDK.

---

## Developing Your Own WebTouch App

A typical pattern looks like this:

1. **Server** – add the hub:

   ```js
   import { attachWebTouchHub } from "webtouch-sdk";
   const io = new Server(httpServer, { /* ... */ });
   attachWebTouchHub(io, { debug: true });
   ```

2. **Kiosk app** – choose an approach:

   * Use `initWebTouchBridge` to control an existing DOM page, *or*
   * Use `createAppClient()` and map `onCursorMove` / `onTap` / `onCustomEvent` into your own app logic.

3. **Controller app** – either:

   * Compose `BaseController` + `TouchpadModule` + `VirtualKeyboardModule` for a generic pointer/keyboard controller, *or*
   * Use `createControllerClient()` and build a custom UI (like the adventure controller).

4. **Data + semantics** – push down semantic events and UI state:

   ```js
   // From app:
   client.sendEventToControllers({
     eventName: "my_app_state",
     payload: { ... },
   });

   // From controller:
   client.sendCustomEvent({
     eventName: "my_action",
     payload: { ... },
   });
   ```

From there, you can mix and match patterns from the examples depending on whether you’re building:

* A single-user kiosk with remote input,
* A multi-user game,
* A collaborative tool with persistent UI state,
* Or something entirely new.

Happy building!

