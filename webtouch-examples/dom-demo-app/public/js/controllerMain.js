// public/js/controllerMain.js

import {
  BaseController,
  TouchpadModule,
  VirtualKeyboardModule,
  // createControllerStore, // optional
} from 'webtouch-sdk';

const controller = new BaseController('#controller-app');

// Use the controller's Socket.IO client
const controllerClient = controller.client;

// Use its module container if available, otherwise fall back to the root
const parent =
  typeof controller.getModuleContainer === 'function'
    ? controller.getModuleContainer()
    : document.getElementById('controller-app');

// Optional shared store
// const store = createControllerStore?.() ?? undefined;

// 1. Touchpad
new TouchpadModule({
  controllerClient,
  parent,
});

  // 2. Keyboard (at the bottom)
  new VirtualKeyboardModule({
    controllerClient,
    parent,
  });
