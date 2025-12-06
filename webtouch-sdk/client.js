// client.js
// Browser-safe entrypoint. 
// EXCLUDES server-side logic (Node.js) like 'os' or 'socket.io-server'.

// -----------------------------------------------------------------------------
// Kiosk / Public App
// -----------------------------------------------------------------------------
export { WebTouchApp } from './public-js/sdk/WebTouchApp.js';
export { launchWebTouchApp } from './public-js/sdk/launchers.js';
export { initWebTouchBridge } from './public-js/sdk/webTouchBridge.js';

// -----------------------------------------------------------------------------
// Controller App
// -----------------------------------------------------------------------------
export { WebTouchController } from './public-js/sdk/WebTouchController.js';
export { launchWebTouchController } from './public-js/sdk/launchers.js';

// Controller Helpers
export { BaseController } from './public-js/controller/BaseController.js';
export { createControllerStore } from './public-js/controller/controllerStore.js';

// Modules
export { TouchpadModule } from './public-js/controller/TouchpadModule.js';
export { VirtualKeyboardModule } from './public-js/controller/VirtualKeyboardModule.js';
export { DrawingpadModule } from './public-js/controller/DrawingPadModule.js';

// -----------------------------------------------------------------------------
// Low-Level Clients
// -----------------------------------------------------------------------------
export {
  createAppClient,
  createControllerClient,
} from './public-js/sdk/webTouchClient.js';