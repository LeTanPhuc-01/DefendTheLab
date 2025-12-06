// scripts/smoke-test.mjs
// Minimal smoke test to ensure the SDK entrypoint exports the expected API.

import {
  attachWebTouchHub,
  WebTouchApp,
  WebTouchController,
  launchWebTouchApp,
  launchWebTouchController,
  createAppClient,
  createControllerClient,
  TouchpadModule,
  VirtualKeyboardModule,
  DrawingpadModule, 
  BaseController,   
  createControllerStore
} from '../index.js';

function assert(name, condition) {
  if (!condition) {
    console.error(`❌ FAILED: ${name}`);
    process.exit(1);
  } else {
    console.log(`✅ ${name}`);
  }
}

console.log('Running WebTouch SDK smoke test...');

// 1. Server Pillar
assert('attachWebTouchHub is a function', typeof attachWebTouchHub === 'function');

// 2. Kiosk/Public Pillar
assert('WebTouchApp is a class', typeof WebTouchApp === 'function');
assert('launchWebTouchApp is a function', typeof launchWebTouchApp === 'function');

// 3. Controller Pillar
assert('WebTouchController is a class', typeof WebTouchController === 'function');
assert('launchWebTouchController is a function', typeof launchWebTouchController === 'function');
assert('BaseController is a class', typeof BaseController === 'function');
assert('createControllerStore is a factory function', typeof createControllerStore === 'function');

// 4. Low-level Clients
assert('createAppClient is a factory function', typeof createAppClient === 'function');
assert('createControllerClient is a factory function', typeof createControllerClient === 'function');

// 5. Modules
assert('TouchpadModule is a class', typeof TouchpadModule === 'function');
assert('VirtualKeyboardModule is a class', typeof VirtualKeyboardModule === 'function');
assert('DrawingpadModule is a class', typeof DrawingpadModule === 'function');

console.log('-----------------------------------');
console.log('🎉 WebTouch SDK smoke test passed.');