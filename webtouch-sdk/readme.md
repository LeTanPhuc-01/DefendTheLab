# WebTouch SDK

WebTouch is a remote-touch controller framework for web-based experiences that need a **public display** and one or more **personal controllers**.

It is built as a **three-pillar architecture**:

1. **Server-side app** – your Node/Express (or similar) backend with a WebTouch hub.
2. **Kiosk-side app** – a public-facing web app running on a TV, display, or browser.
3. **Controller-side app** – one or more personal controllers running on phones or tablets.

Each pillar has its own SDK entry point so you can plug WebTouch into your stack with minimal boilerplate while keeping full control over your own app logic.

Typical uses include:

- Lobby or conference kiosks
- Museum / gallery installations
- Multiplayer web games on a TV
- Remote-control dashboards and tools

---

## 0. Features at a Glance

- 🔀 **Instant Pairing**: Connect controllers to the kiosk via temporary 4-letter room codes or QR codes.
- 👥 **Dual-Mode Architecture**:
  - **Single-User Mode**: Aggregates all inputs into one shared cursor (perfect for menus/kiosks).
  - **Multi-User Mode**: Tracks individual users with unique cursors and private state (perfect for games/whiteboards).
- 📡 **Bi-Directional Communication**:
  - **Broadcast**: Kiosk → All Controllers.
  - **Unicast**: Kiosk → Specific Controller (e.g., send private game state, colors, or haptic feedback to one specific user).
- 🔄 **Seamless App Switching**: Navigate the kiosk to a new URL/App, and all connected controllers automatically reload with the new controls. No re-scanning required.
- 🖱️ **Hybrid Input**:
  - **Mobile**: Touchpad with multi-touch gestures and "Clutch" buttons.
  - **Desktop**: Pointer Lock API for infinite mouse movement.
- 🧩 **Composable Modules**: Plug-and-play UI components including **Touchpad**, **Virtual Keyboard**, and **Drawing Pad**.
- 🧠 **Three-Pillar API**: Distinct, easy-to-extend entry points for the Server, Kiosk, and Controller.

---

## 1. Architecture: Three Pillars

```
Kiosk / Public App (browser/TV)
           ▲
           │  controller_event / core:* / custom:*
           │
           ▼
Server + WebTouch Hub (Node + Socket.IO)
           ▲
           │
           │  sendCursorMove / sendCustomEvent / ...
           ▼
 Controller Apps (phones/tablets)

```

WebTouch is designed around three cooperating apps:

1. **Server-side app (hub / backend)**
   - Runs in Node.
   - Owns the WebSocket connections.
   - Creates and manages **rooms** that bind one kiosk to one or more controllers.
   - Entry point:
     - `attachWebTouchHub(io, options)` – attaches the hub to an existing `socket.io` server.
   - Extensibility:
     - Add your own Express routes, databases, and APIs.
     - Use hub hooks (e.g. `onControllerEvent`, `onAppRegistered`) to integrate with your domain logic.

2. **Kiosk-side app (public view)**
   - Runs in a browser, TV, or kiosk environment.
   - Renders the **public UI** – canvas, DOM, React, Phaser, etc.
   - Entry points:
     - Base class: `WebTouchApp`.
     - Launcher: `launchWebTouchApp({ AppClass, ... })`.
   - Extensibility:
     - Extend `WebTouchApp` and override lifecycle hooks:
       - `onInit(ctx)`
       - `onCursorMove(x, y, ctx)`
       - `onTap(event, ctx)`
       - `onKeyPress(event, ctx)`
       - `onCustomEvent(name, payload, ctx)`
     - Use `ctx.client` for lower-level control when needed.

3. **Controller-side app (personal controller)**
   - Runs in mobile browsers (phones, tablets, laptops).
   - Renders the **control surface** – touchpad, buttons, sliders, keyboards, custom UIs.
   - Entry points:
     - Base class: `WebTouchController`.
     - Launcher: `launchWebTouchController({ ControllerClass, ... })`.
   - Extensibility:
     - Extend `WebTouchController` and implement:
       - `buildUI(container, client, store, ctx)`
     - Use `client` to send events (`sendCursorMove`, `sendTap`, `sendKeyPress`, `sendButton`, `sendCustomEvent`).
     - Use `store` for shared controller-side state when composing multiple modules.

The three pillars communicate via:

- **Socket.IO** on the server pillar.
- A small set of **core events** plus **custom events** on the kiosk and controller pillars.
- A **room code** that binds exactly one kiosk instance and any number of controllers together.


---

## 2. Project Structure


```text
webtouch-sdk/
  package.json
  README.md
  index.js                # re-export public API (3 pillars)

  lib/                    # Server-side (Node) pillar
    webTouchHub.js        # export attachWebTouchHub()

  public-js/              # Browser-side code (kiosk + controller pillars)
    sdk/                  # core SDK for both kiosk + controller apps
      webTouchClient.js   # createAppClient / createControllerClient
      webTouchBridge.js   # DOM bridge for kiosk app (cursor, QR, rejoin)
      WebTouchApp.js      # base class for kiosk/public apps
      WebTouchController.js # base class for controller apps
      launchers.js        # launchWebTouchApp / launchWebTouchController

    controller/           # optional controller helpers & modules
      BaseController.js   # internal shell used by WebTouchController
      controllerStore.js  # simple controller-side state store
      TouchpadModule.js   # built-in touchpad module
      VirtualKeyboardModule.js
      DrawingpadModule.js

examples/
  whiteboard/
    package.json
    server.js             # uses attachWebTouchHub() from webtouch-sdk

    public/
      app.html
      controller.html
      css/
        webtouch.css
        webtouchController.css
      js/
        WhiteboardDemoApp.js        # extends WebTouchApp
        WhiteboardDemoController.js # extends WebTouchController
        appMain.js                  # calls launchWebTouchApp({ AppClass: WhiteboardDemoApp, ... })
        controllerMain.js           # calls launchWebTouchController({ ControllerClass: WhiteboardDemoController, ... })

```

Key pieces for developers:

- **Server app**: `server.js` + `lib/webTouchHub.js` (attach the hub and add your own routes/APIs).
- **Public app**: extend `WebTouchApp`, launch via `launchWebTouchApp(config)`.
- **Controller app**: extend `WebTouchController`, launch via `launchWebTouchController(config)`.

---

## 3. Server Setup

The server is a standard Express + Socket.IO app with a WebTouch hub attached.

```js
// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const { attachWebTouchHub } = require('./lib/webTouchHub');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.get('/controller', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'controller.html'));
});

// Attach the WebTouch Hub
attachWebTouchHub(io, {
  debug: true,
  // Optional hooks you can add later:
  // onControllerEvent(roomId, eventName, payload) {},
  // onAppRegistered(roomId, socket, initialState) {},
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
```

Run it:

```bash
npm install
npm start
# or
node server.js
```

---

## 4. HTML Shells

### 4.1 `app.html` (public / kiosk view)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>WebTouch App</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="/css/webtouch.css" />
</head>
<body>
  <!-- QR code + room code -->
  <div id="qrCodeContainer"></div>

  <!-- Remote cursor -->
  <div id="cursor"></div>

  <!-- App content goes here -->
  <div id="app-root"></div>

  <script src="/socket.io/socket.io.js"></script>
  <script src="/js/vendor/qrcode.min.js"></script>

  <!-- Your kiosk app bootstrap -->
  <script type="module" src="/js/demo/appMain.js"></script>
</body>
</html>
```

Key IDs:

* `#qrCodeContainer` – QR / room code.
* `#cursor` – remote cursor element (positioned by the SDK).
* `#app-root` – your app’s main content root.

---

### 4.2 `controller.html` (personal controller view)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>WebTouch Controller</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="/css/webtouch.css" />
  <link rel="stylesheet" href="/css/webtouchController.css" />
</head>
<body>
  <div id="controller-app"></div>

  <script src="/socket.io/socket.io.js"></script>

  <!-- Your controller app bootstrap -->
  <script type="module" src="/js/demo/controllerMain.js"></script>
</body>
</html>
```

Key ID:

* `#controller-app` – root container for your controller UI.

---

## 5. Public App: Quickstart

### 5.1 Extend `WebTouchApp`

Define a public/kiosk app class by extending the base:

```js
// public/js/demo/WhiteboardDemoApp.js
import { WebTouchApp } from '../sdk/WebTouchApp.js';

export class WhiteboardDemoApp extends WebTouchApp {
  onInit(ctx) {
    // Build DOM / canvas inside ctx.appRoot
    ctx.appRoot.innerHTML = `
      <canvas id="whiteboardCanvas" width="1280" height="720"></canvas>
    `;
    this.canvas = document.getElementById('whiteboardCanvas');
    this.ctx2d = this.canvas.getContext('2d');

    // Setup drawing state, camera, etc.
  }

  onCursorMove(x, y, ctx) {
    // x, y are screen coordinates for the remote cursor
    this.ctx2d.fillRect(x, y, 2, 2);
  }

  onTap(event, ctx) {
    // Optional: handle explicit tap events
  }

  onKeyPress(event, ctx) {
    // Optional: handle keyboard input from controller
  }

  onCustomEvent(name, payload, ctx) {
    // Handle custom events from controllers
    if (name === 'whiteboard:stroke') {
      // draw stroke segments from payload
    }
  }
}
```

### 5.2 Launch via `launchWebTouchApp(config)`

```js
// public/js/demo/appMain.js
import { launchWebTouchApp } from '../sdk/launchers.js';
import { WhiteboardDemoApp } from './WhiteboardDemoApp.js';

launchWebTouchApp({
  AppClass: WhiteboardDemoApp,
  selectors: {
    appRoot: '#app-root',
    cursor: '#cursor',
    qr: '#qrCodeContainer',
  },
  debug: true,
});
```

The SDK will:

* Connect to the server.
* **Try to rejoin the last room** (room code stored in `sessionStorage`).
* If rejoin fails, register a new room.
* Render a QR + room code.
* Track the remote cursor and forward events into your hooks.

Room re-use is handled automatically: if a new app launches in the same kiosk, it will try to adopt the previous room code so connected controllers don’t need to re-scan.

---

## 6. Controller App: Quickstart

### 6.1 Extend `WebTouchController`

```js
// public/js/demo/WhiteboardDemoController.js
import { WebTouchController } from '../sdk/WebTouchController.js';
import { WhiteboardModule } from '../controller/WhiteboardModule.js';
import { VirtualKeyboardModule } from '../controller/VirtualKeyboardModule.js';

export class WhiteboardDemoController extends WebTouchController {
  buildUI(container, client, store) {
    // Compose built-in controller modules
    new WhiteboardModule({ controllerClient: client, store, parent: container });
    new VirtualKeyboardModule({ controllerClient: client, parent: container });

    // Or add your own custom controls here
  }
}
```

### 6.2 Launch via `launchWebTouchController(config)`

```js
// public/js/demo/controllerMain.js
import { launchWebTouchController } from '../sdk/launchers.js';
import { WhiteboardDemoController } from './WhiteboardDemoController.js';

launchWebTouchController({
  ControllerClass: WhiteboardDemoController,
  rootSelector: '#controller-app',
});
```

The SDK will:

* Prefer a `?room=ABCD` URL query parameter if present.
* Otherwise, auto-rejoin the **last room code** stored in `sessionStorage`.
* Fall back to a manual join form if no room is known.
* Show connection status.
* Provide:

  * a `container` for your UI,
  * a `client` to send events,
  * a `store` for controller-side state.

When the public app **switches apps but keeps the same room**, controllers automatically reload into the new controller app (see Section 10).

---

## 7. Event Model

### 7.1 Core events (controller → kiosk app)

The SDK uses a small set of event types between controllers and the kiosk app:

* `core:cursor_move` – delta-based cursor movement.
* `core:tap` – tap/click events.
* `core:key_press` – keyboard-like input.
* `core:button` – generic on/off/value buttons.
* `custom:*` – fully user-defined events.

The public app receives them through:

* `onCursorMove(x, y, ctx)`
* `onTap(event, ctx)`
* `onKeyPress(event, ctx)`
* `onCustomEvent(name, payload, ctx)`

Controllers send them via the `client` object:

```js
// From controller side (inside buildUI)
client.sendCursorMove({ deltaX, deltaY });

client.sendTap({
  source: 'touchpad', // e.g. 'touchpad', 'buttonA', etc.
});

client.sendKeyPress({
  key: 'a', // or 'Enter', 'Backspace', etc.
});

client.sendButton({
  buttonId: 'start',
  state: 'down', // or 'up'
  value: 1,      // optional numeric value
});

client.sendCustomEvent({
  eventName: 'whiteboard:strokeStart',
  payload: { worldX, worldY, color, lineWidth },
});
```

You are free to design your own custom event schema; the SDK just transports messages.

### 7.2 Hub events (server → clients)

The hub also emits several events:

**To the public app (via app client / bridge):**

* `your_room_id` – assigns (or confirms) the room code.
* `initial_state` – last-known state snapshot (if any).
* `controller_presence_changed` – number of controllers in the room.

**To controllers (via controller client / `BaseController`):**

* `invalid_room` – room doesn’t exist.
* `join_success` – successfully attached to room.
* `app_disconnected` – public app for this room went away.
* `app_reconnected` – public app came back.
* `controller_refresh` – **public app has switched while keeping this room; controller should reload.**

Section 10 explains `controller_refresh` in more detail.

---

## 8. Built-in Controller Modules (Optional)

The SDK ships with some ready-made controller-side modules:

* `TouchpadModule` – two-dimensional touchpad that moves the remote cursor.
* `VirtualKeyboardModule` – on-screen keyboard that sends key events.
* `WhiteboardModule` – drawing / typing / pan tools for a whiteboard-style app.

Usage:

```js
new TouchpadModule({ controllerClient: client, parent: container });
new VirtualKeyboardModule({ controllerClient: client, parent: container });
new WhiteboardModule({ controllerClient: client, store, parent: container });
```

You can:

* Use them as building blocks.
* Use the source as a reference for building your own modules.
* Ignore them and implement entirely custom controller UIs.

---

## 9. Advanced: Using the Core Client Directly

If you want full control and don’t want to use the base classes:

* On the public side, import `createAppClient` from `webTouchClient.js`.
* On the controller side, import `createControllerClient` from `webTouchClient.js`.
* Skip `WebTouchApp` / `WebTouchController` and manage everything yourself.

Example (public side, low-level):

```js
import { createAppClient } from '../sdk/webTouchClient.js';

const client = createAppClient({
  onCursorMove({ x, y }) { /* ... */ },
  onTap(evt) { /* ... */ },
  onKeyPress(evt) { /* ... */ },
  onButton(evt) { /* ... */ },
  onCustomEvent(name, payload) { /* ... */ },
});

// Try to rejoin last room, or register new if none/failed
const lastRoom = sessionStorage.getItem('webTouchRoomCode');
if (lastRoom) {
  client.rejoinRoom(lastRoom);
} else {
  client.registerNewRoom();
}
```

This path is useful if you’re integrating WebTouch into an existing engine or framework with its own lifecycle.

---

## 10. Using WebTouch in Teams / Projects

A common workflow for maintainers and teams:

1. Clone or fork this repo as a starter.
2. Treat `/sdk` and `/controller` as the “framework” layer.
3. Create your own folders under `public/js` for your project, e.g. `public/js/myApp/`.
4. Implement:

   * `MyKioskApp` extending `WebTouchApp`.
   * `MyController` extending `WebTouchController`.
5. Wire them via `launchWebTouchApp` and `launchWebTouchController` in small bootstrap files (`appMain.js`, `controllerMain.js`).
6. Add any additional server routes, database logic, or APIs as needed.

This approach keeps the WebTouch infrastructure stable while giving you complete control over:

* server-side logic (additional routes, persistence, scoring, etc.),
* public-side UX and rendering (DOM, Canvas, Phaser, React, etc.),
* controller-side UX, layout, and input semantics.

---

## 11. Seamless App Switching & Session Persistence

WebTouch allows you to build multi-page experiences (e.g., an **"Arcade Lobby"** that launches into specific **"Games"**) without forcing users to disconnect and rescan a QR code every time the page changes.

### 11.1 The "Connect Once" Workflow

1.  **The Lobby:** Users scan a QR code on your main index page (The Lobby). They get a generic controller (e.g., a D-Pad for menu navigation).
2.  **The Launch:** When the Kiosk navigates to a new URL (e.g., `/games/racer`), WebTouch automatically detects the active session.
3.  **The Handoff:**
    *   The **Kiosk** reclaims the existing 4-letter Room Code from `sessionStorage`.
    *   The **Hub** detects the app has changed (reconnected).
    *   The **Hub** sends a `controller_refresh` signal to all connected phones.
4.  **The Update:** All connected phones automatically reload. They fetch the new controller logic required for the specific game (e.g., a Steering Wheel) and instantly rejoin the room.

**Result:** Users stay connected seamlessly as you navigate the host display through different web apps.

### 11.2 How it works under the hood

This behavior is enabled automatically by the `WebTouchApp` and `BaseController` classes:

1.  **Kiosk Persistence**:
    When `WebTouchApp` initializes, it checks `sessionStorage['webTouchRoomCode']`.
    *   **Found?** It calls `rejoinRoom(code)` to maintain the session.
    *   **Not Found?** It calls `registerNewRoom()` to start a fresh session.

2.  **Controller Refresh**:
    When the Kiosk successfully rejoins, the Hub broadcasts a `controller_refresh` event. The `BaseController` on the phone handles this by reloading the page with the current room code in the URL:

    ```javascript
    // Inside BaseController.js (handled automatically by the SDK)
    this.client.onControllerRefresh(({ roomCode }) => {
      // Reloads the controller page to fetch new UI/Logic for the new App
      const url = new URL(window.location.href);
      url.searchParams.set('room', roomCode);
      window.location.href = url.toString();
    });
    ```

This ensures that the Controller UI always matches the active Kiosk App without manual intervention.

### 11.3 App Hand-Off Life Cycle

This relies on standard browser behavior where `sessionStorage` persists across page navigations within the **same domain** (Origin).

1.  **The "Parking" Phase**:
    When the Kiosk navigates away, the Server detects the disconnect but **holds the Room and Controllers in memory** instead of destroying them.

2.  **The "Reclaim" Phase**:
    When the new page loads, the SDK reads the previous Room Code from `sessionStorage` and sends a `rejoin` request.

3.  **The "Refresh" Phase**:
    Once the Server validates the rejoin, it broadcasts `controller_refresh` to the held controllers, instructing them to reload their UI to match the new App.

---

