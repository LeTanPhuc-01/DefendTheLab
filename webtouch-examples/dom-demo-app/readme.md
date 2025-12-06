# WebTouch DOM-Bridge Demo App

This example shows how to use the **WebTouch SDK** to remotely control a **regular DOM page** (forms, buttons, inputs) from a phone-based controller – without changing your app’s business logic.

* The **desktop page** renders a normal form and a clickable box.
* The **controller** is a phone UI with a **touchpad** and **virtual keyboard**.
* The WebTouch SDK:

  * pairs them via a 4-letter room code + QR code,
  * moves a remote cursor,
  * forwards taps as real DOM clicks,
  * and injects key presses into the currently focused input/textarea.

This example consumes the published-style SDK:

* `import { attachWebTouchHub } from "webtouch-sdk"` on the server
* `import { initWebTouchBridge } from "webtouch-sdk"` in the app
* `import { BaseController, TouchpadModule, VirtualKeyboardModule } from "webtouch-sdk"` in the controller

It’s a **consumer demo**, not the SDK source.

---

## Project Structure

```text
dom-bridge-demo-app/
├─ server.js                 # Express + Socket.IO server, attaches WebTouch hub
├─ package.json              # Depends on webtouch-sdk from ../webtouch-sdk
└─ public/
   ├─ app.html               # Desktop app (form + demo content)
   ├─ controller.html        # Phone controller shell
   ├─ css/
   │  └─ domBridgeApp.css    # App-specific layout & form styling
   └─ js/
      ├─ appMain.js          # App logic + WebTouch DOM bridge
      └─ controllerMain.js   # BaseController + Touchpad + VirtualKeyboard wiring
```

The actual SDK code lives in the sibling repo `webtouch-sdk/` and is consumed via `node_modules`.

---

## 1. Server: attach the WebTouch hub

The demo uses a minimal Node/Express/Socket.IO server that imports the hub from the SDK and serves static files.

```js
// server.js

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

import { attachWebTouchHub, printDevBanner } from "webtouch-sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// Attach WebTouch hub from the SDK (room codes, controller/app relay, etc.)
attachWebTouchHub(io, { debug: true });

// Serve static assets
app.use(express.static(path.join(__dirname, "public")));
app.use("/node_modules", express.static(path.join(__dirname, "node_modules")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "app.html"));
});

app.get("/controller", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "controller.html"));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, "0.0.0.0", () => {
  printDevBanner(PORT);
});
```

---

## 2. App: DOM-Bridge integration

The app page is just a normal form + clickable box:

```html
<!-- public/app.html (excerpt) -->
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Full Page Cursor Control (Room Instance)</title>

  <!-- SDK kiosk chrome (cursor, QR, focus helpers) -->
  <link
    rel="stylesheet"
    href="/node_modules/webtouch-sdk/public-css/webtouch.css"
  />
  <!-- App-specific layout (form, main-content) -->
  <link rel="stylesheet" href="/css/domBridgeApp.css" />
</head>
<body>
  <div id="qrCodeContainer">
    <p>Loading Room...</p>
  </div>

  <!-- Remote cursor (DOM bridge will move this) -->
  <div id="cursor"></div>

  <div class="main-content">
    <h1>Full Page Control Demo (Room Instance)</h1>
    <p>
      Scan the QR code or enter the 4-letter ROOM CODE at
      <a href="/controller" target="_blank">/controller</a>
      to control ONLY this view.
    </p>

    <div class="clickable-box" id="testBox">Click Me!</div>
  </div>

  <div id="inputArea">
    <form id="testForm">
      <!-- text input, textarea, radio group, checkbox group, submit button -->
      <!-- (see full file in repo) -->
    </form>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>

  <!-- Import map: point "webtouch-sdk" to the browser entry -->
  <script type="importmap">
  {
    "imports": {
      "webtouch-sdk": "/node_modules/webtouch-sdk/client.js"
    }
  }
  </script>

  <script type="module" src="/js/appMain.js"></script>
</body>
```

In `appMain.js`, the app logic is totally WebTouch-agnostic; the bridge is plugged in at the end:

```js
// public/js/appMain.js

import { initWebTouchBridge } from "webtouch-sdk";

// --- App's pure business logic (no knowledge of WebTouch) ---

const testForm = document.getElementById("testForm");
const testBox = document.getElementById("testBox");

function simulateFormClear(form) {
  console.log("Simulating form clear on submit...");

  form.elements["textField"].value = "";
  form.elements["textArea"].value = "";
  form.elements["radioGroup"].forEach(
    (radio) => (radio.checked = radio.value === "opt2")
  );
  form.elements["checkItem1"].checked = false;
  form.elements["checkItem2"].checked = false;
  form.elements["checkItem3"].checked = true;
}

if (testBox) {
  testBox.addEventListener("click", () => {
    testBox.textContent = "Clicked!";
    setTimeout(() => (testBox.textContent = "Click Me!"), 1500);
  });
}

if (testForm) {
  testForm.addEventListener("submit", (e) => {
    e.preventDefault();
    simulateFormClear(testForm);
  });
}

// --- Attach the WebTouch DOM bridge ---
// This injects remote control: cursor, QR, taps → clicks, keys → typing.

initWebTouchBridge({
  cursorElement: document.getElementById("cursor"),
  qrCodeContainer: document.getElementById("qrCodeContainer"),
});
```

The SDK’s bridge (`initWebTouchBridge`) takes over:

* creates / rejoins a room,
* renders QR code + room label,
* moves `#cursor` based on controller touchpad input,
* performs hit-testing + DOM clicks on tap,
* and types into the currently focused field when keys arrive from the controller.

---

## 3. Controller: BaseController + modules

The controller page is a thin shell; styling comes from the SDK:

```html
<!-- public/controller.html (excerpt) -->
<head>
  <meta charset="UTF-8" />
  <title>Touch Controller</title>
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, user-scalable=no"
  />

  <!-- SDK controller shell (join form, status bar, touchpad, keyboard) -->
  <link
    rel="stylesheet"
    href="/node_modules/webtouch-sdk/public-css/webtouchController.css"
  />
</head>
<body>
  <div id="controller-app"></div>

  <script src="/socket.io/socket.io.js"></script>

  <script type="importmap">
  {
    "imports": {
      "webtouch-sdk": "/node_modules/webtouch-sdk/client.js"
    }
  }
  </script>

  <script type="module" src="/js/controllerMain.js"></script>
</body>
```

In `controllerMain.js`, we wire up the SDK’s `BaseController` and modules:

```js
// public/js/controllerMain.js

import {
  BaseController,
  TouchpadModule,
  VirtualKeyboardModule,
} from "webtouch-sdk";

// BaseController handles:
// - Room code entry / URL ?room=XXXX
// - Join/disconnect/app-disconnect messaging
// - Overall layout skeleton
const controller = new BaseController("#controller-app");

// Use the controller's Socket.IO client
const controllerClient = controller.client;

// Use its module container if available, otherwise fall back to the root
const parent =
  typeof controller.getModuleContainer === "function"
    ? controller.getModuleContainer()
    : document.getElementById("controller-app");

// 1. Touchpad module (drag to move cursor, tap to click)
new TouchpadModule({
  controllerClient,
  parent,
});

// 2. Virtual keyboard module (types into focused field)
new VirtualKeyboardModule({
  controllerClient,
  parent,
});
```

You can remove the keyboard module if you want a simpler “pointer-only” controller.

---

## Running the Demo

### 1. Install dependencies

From the `dom-bridge-demo-app` folder:

```bash
npm install
```

> Note: `package.json` depends on `webtouch-sdk` via:
>
> ```json
> "webtouch-sdk": "file:../../webtouch-sdk"
> ```
>
> Make sure the sibling `webtouch-sdk` folder exists and is installable.

### 2. Start the server

```bash
npm start
# or
node server.js
```

The server runs on `http://localhost:3000`.

### 3. Open the app and controller

1. **Desktop app:**
   Go to `http://localhost:3000/` in a desktop browser.
   You’ll see:

   * the form + demo content
   * the QR badge in the top-right
   * a hidden red cursor (it becomes visible when a controller connects)

2. **Controller (phone):**

   * On your phone (same Wi-Fi), open the URL shown in the console banner,
     or scan the QR code.
   * The controller page will show:

     * room join bar (if not auto-joined via QR),
     * a touchpad area,
     * and a virtual keyboard.

3. **Control the page:**

   * Drag on the touchpad → cursor moves on the desktop app.
   * Tap → click/focus the element under the cursor.
   * Use the keyboard → text appears in the focused input/textarea.
   * Press Enter in a non-textarea input → the form submits and resets.

---
