// index.js
// Public entrypoint for the WebTouch SDK.
// Exposes the three pillars (server, kiosk, controller) plus some advanced helpers.

// -----------------------------------------------------------------------------
// Server-side pillar (Node)
// -----------------------------------------------------------------------------

export { attachWebTouchHub } from './lib/webTouchHub.js';

// Dev utility for testing phones on IP of localhost
export { printDevBanner } from './lib/devUtils.js'; 

// -----------------------------------------------------------------------------
// Kiosk / public app pillar (browser)
// -----------------------------------------------------------------------------

export { WebTouchApp } from './public-js/sdk/WebTouchApp.js';
export { launchWebTouchApp } from './public-js/sdk/launchers.js';

// Advanced: direct access to the DOM bridge (if someone wants to bypass WebTouchApp)
export { initWebTouchBridge } from './public-js/sdk/webTouchBridge.js';

// -----------------------------------------------------------------------------
// Controller app pillar (browser)
// -----------------------------------------------------------------------------

export { WebTouchController } from './public-js/sdk/WebTouchController.js';
export { launchWebTouchController } from './public-js/sdk/launchers.js';

// Optional controller framework bits (usually not needed directly if using WebTouchController)
export { BaseController } from './public-js/controller/BaseController.js';
export { createControllerStore } from './public-js/controller/controllerStore.js';

// Built-in controller modules
export { TouchpadModule } from './public-js/controller/TouchpadModule.js';
export { VirtualKeyboardModule } from './public-js/controller/VirtualKeyboardModule.js';

// REFACTOR NOTE: Ensure filename case matches 'DrawingPadModule.js'
export { DrawingpadModule } from './public-js/controller/DrawingpadModule.js';

// -----------------------------------------------------------------------------
// Advanced: low-level clients (for custom integrations)
// -----------------------------------------------------------------------------

export {
  createAppClient,
  createControllerClient,
} from './public-js/sdk/webTouchClient.js';