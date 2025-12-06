import {
  WebTouchController,
  VirtualKeyboardModule,
  DrawingpadModule // Used to be WhiteboardModule
} from 'webtouch-sdk';

export class WhiteboardDemoController extends WebTouchController {
  buildUI(container, client, store) {
    
    // 1. Drawing Pad
    // Contains Tools + Pad + Logic for a complete drawing experience
    new DrawingpadModule({
      controllerClient: client,
      parent: container,
      store: store
    });

    // 2. Keyboard (at the bottom)
    new VirtualKeyboardModule({
      controllerClient: client,
      parent: container
    });
  }
}