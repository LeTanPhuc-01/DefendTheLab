# WebTouch + Phaser Dodger – Multiplayer Game Demo

This example shows how to use the **WebTouch SDK** to drive a **multiplayer Phaser game** from phone-based controllers.

- The **desktop app** runs a simple dodger game built in Phaser 3.
- Each **phone controller** is a touchpad that moves a player square.
- The WebTouch SDK handles:
  - room creation + QR codes,
  - controller pairing,
  - multi-controller events (`controllerId`),
  - reconnects and presence changes.

The goal of this example is to show a **full-stack pattern**:

> Phaser game logic is clean and isolated.  
> WebTouch just plugs in via a small adapter.

---

## 1. Project Structure

```text
game-phaser-dodger/
├─ server.js                 # Express + Socket.IO + WebTouch hub
├─ package.json
└─ public/
   ├─ app.html               # Phaser game (desktop kiosk/app)
   ├─ controller.html        # Phone controller UI shell
   └─ js/
      ├─ appMain.js          # WebTouch app wiring + Phaser adapter
      ├─ controllerMain.js   # WebTouch controller wiring (BaseController + Touchpad)
      └─ game/
         └─ PhaserDodgerGame.js  # Phaser game wrapper + GameScene logic
````

---

## 2. How It Works

### Server

`server.js` uses the **WebTouch hub** from the SDK:

* `attachWebTouchHub(io, { debug: true })` manages:

  * room codes (e.g., `ABCD`),
  * one app + many controllers per room,
  * generic `controller_event` messages with `controllerId`.

The server also serves static files and exposes `/` (game) and `/controller` (controller).

### App (Desktop Game)

The desktop game lives in `public/app.html` and `public/js/appMain.js`.

* `app.html` loads:

  * Phaser 3,
  * Socket.IO,
  * WebTouch SDK (via import map),
  * and the main script `appMain.js`.

* `appMain.js`:

  * creates a **WebTouch app client** with `createAppClient()`,
  * registers / rejoins rooms and renders the QR code,
  * creates a `PhaserDodgerGame` instance and starts it once a room ID is assigned,
  * listens for WebTouch events:

    * `onControllerJoined(controllerId)`
    * `onControllerDisconnected(controllerId)`
    * `onCursorMove(payload, controllerId)`
    * `onTap(payload, controllerId)`
  * and forwards those to `PhaserDodgerGame`:

    ```js
    const game = new PhaserDodgerGame({ parentId: "game-container" });

    client.onControllerJoined((controllerId) => {
      const meta = assignPlayerMeta(controllerId); // playerNumber + color
      game.controllerJoined(controllerId, meta);
    });

    client.onCursorMove(({ deltaX, deltaY }, controllerId) => {
      game.cursorMove(controllerId, deltaX, deltaY);
    });

    client.onTap(({ source }, controllerId) => {
      game.tap(controllerId, source);
    });
    ```

#### PhaserDodgerGame and GameScene

`public/js/game/PhaserDodgerGame.js` contains:

* `PhaserDodgerGame`:

  * owns the Phaser `Game` instance,
  * starts/restarts `GameScene`,
  * queues joins until the scene is fully ready (avoids race conditions),
  * exposes a small API called from `appMain.js`:

    * `controllerJoined(controllerId, meta)`
    * `controllerLeft(controllerId)`
    * `cursorMove(controllerId, dx, dy)`
    * `tap(controllerId, source)`.

* `GameScene`:

  * the actual Phaser scene:

    * players are colored squares (rectangles),
    * enemies fall from the top,
    * collision = game over,
    * tap on controller = restart.

`GameScene` knows *nothing* about WebTouch or Socket.IO—it only sees:

* `addPlayer(controllerId, meta)`
* `removePlayer(controllerId)`
* `onPlayerMove(controllerId, deltaX, deltaY)`
* `onPlayerAction(controllerId, source)`.

---

### Controller (Phone)

The controller lives in `public/controller.html` and `public/js/controllerMain.js`.

* `controller.html` is minimal:

  * `#controller-app` root div,
  * SDK controller CSS,
  * Socket.IO + WebTouch import map,
  * `controllerMain.js`.

* `controllerMain.js` uses the **high-level controller shell** in the SDK:

  ```js
  import {
    BaseController,
    TouchpadModule,
  } from "webtouch-sdk";

  const controller = new BaseController("#controller-app");

  const controllerClient = controller.client;
  const parent =
    typeof controller.getModuleContainer === "function"
      ? controller.getModuleContainer()
      : document.getElementById("controller-app");

  new TouchpadModule({
    controllerClient,
    parent,
  });
  ```

`BaseController` handles:

* room join form,
* status messages,
* connecting to the WebTouch hub via `createControllerClient`.

`TouchpadModule` renders a touch area that:

* sends `CURSOR_MOVE` events as `{ deltaX, deltaY }`,
* sends `TAP` events with `{ source }` (“single_tap”, “two_finger”, etc.).

Both are fully managed by the SDK; the example doesn’t need to touch raw Socket.IO calls on the controller side.

---

## 3. Running the Demo

From the `game-phaser-dodger` folder:

```bash
npm install
npm start
```

You should see something like:

```text
🚀 WebTouch Dev Server Running on Port 3000
[vEthernet]: http://172.30.xxx.xxx:3000/
[Wi-Fi]:     http://192.168.x.x:3000/
```

### 1. Open the Game (App)

On your desktop/laptop browser:

* Navigate to the `Wi-Fi` URL (e.g., `http://192.168.x.x:3000/`).
* You will see:

  * the Phaser game area,
  * a QR code + 4-letter room code in the top-right.

The game will show “Waiting for player(s) to join…”.

### 2. Open the Controller

On your phone (connected to the same Wi-Fi):

* Scan the QR code, **or**
* Open the URL printed in the QR (e.g., `http://192.168.x.x:3000/controller?room=ABCD`).

You’ll see:

* a join form (if the room code is not in the URL),
* then a full-screen touchpad + status bar once connected.

### 3. Play

* Each connected controller becomes a new player in the game (a colored square).
* Drag on the phone to move your player and dodge falling enemies.
* When any player is hit:

  * the game pauses,
  * the hit player turns red, others gray,
  * the app shows “Game Over! Tap controller to restart.”
* Tap on your controller to restart the game with the same players.

You can connect multiple controllers at once; each gets a unique player number and color.

---

## 4. What This Example Demonstrates

This example is designed to show:

* How to use `attachWebTouchHub` to manage **rooms and controllers**.
* How to use `createAppClient` on the app side to:

  * create/rejoin rooms,
  * get `controllerId`-aware events (`onControllerJoined`, `onCursorMove`, `onTap`, etc.).
* How to use `BaseController` + `TouchpadModule` on the controller side so a controller can be built in just a few lines.
* How to **cleanly separate game logic from WebTouch wiring** by using a small adapter (`PhaserDodgerGame`) instead of mixing socket code into your Phaser scene.

You can use the same pattern for other engines or apps:

1. Wrap your app/framework in a small adapter (like `PhaserDodgerGame`).
2. Use `createAppClient()` to drive that adapter based on WebTouch events.
3. Use `BaseController` and modules (`TouchpadModule`, `VirtualKeyboardModule`, etc.) for the controller UX.

---
