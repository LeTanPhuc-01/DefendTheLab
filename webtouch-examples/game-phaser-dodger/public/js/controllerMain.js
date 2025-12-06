// public/js/controllerMain.js

import {
  BaseController,
  TouchpadModule,
} from "webtouch-sdk";

// Base controller: join form, status, wiring to SDK controller client
const controller = new BaseController('#controller-app');

// Use the controller's Socket.IO client
const controllerClient = controller.client;

// Use its module container if available, otherwise fall back to the root
const parent =
  typeof controller.getModuleContainer === 'function'
    ? controller.getModuleContainer()
    : document.getElementById('controller-app');

// Touchpad controls the game (no keyboard needed for this demo)
new TouchpadModule({
  controllerClient,
  parent,
});
