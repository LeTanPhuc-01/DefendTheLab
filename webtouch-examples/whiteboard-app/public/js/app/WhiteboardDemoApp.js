// examples/whiteboard/public/js/app/WhiteboardDemoApp.js
//
// WhiteboardDemoApp
// -----------------
// Kiosk/public-side app for the multi-user whiteboard example.
// Extends WebTouchApp from webtouch-sdk using "Multi-User Mode".

import { WebTouchApp } from 'webtouch-sdk';
import { resizeCanvasToDisplaySize, redrawAll } from './drawingUtils.js';

export class WhiteboardDemoApp extends WebTouchApp {
  constructor(config) {
    // 1. Enable Multi-User Mode
    // The SDK automatically manages the `this._cursors` Map, handles connection
    // lifecycles, and applies physics to cursor positions.
    super({ ...config, multiUser: true });
  }

  onInit(appCtx) {
    const appRoot = appCtx.appRoot;
    if (!appRoot) throw new Error('WhiteboardDemoApp: appRoot not found');

    // 2. Setup DOM & Canvas
    appRoot.innerHTML = `
      <div class="whiteboard-shell">
        <div class="whiteboard-canvas-wrapper">
          <canvas id="whiteboardCanvas"></canvas>
        </div>
      </div>
    `;

    const canvas = document.getElementById('whiteboardCanvas');
    const ctx = canvas.getContext('2d');

    // 3. Initialize Board Content State
    // (User state is handled separately by the SDK in `this._cursors`)
    this.state = {
      viewportX: 0,
      viewportY: 0,
      strokes: [],              // Completed strokes (lines)
      activeStrokes: new Map(), // Currently drawing strokes
      texts: [],                // Completed text blocks
    };

    // 4. Setup Render Loop
    // We pass `this._cursors` to the renderer so it can draw user cursors/tags
    const render = () => redrawAll(ctx, canvas, this.state, this._cursors);
    const handleResize = () => resizeCanvasToDisplaySize(canvas, ctx, this.state, render);

    window.addEventListener('resize', handleResize);
    handleResize();
    
    // Save render reference for hooks
    this._render = render;

    // 5. Special Case: Panning (Infinite Canvas)
    // The SDK's onPlayerUpdate gives us Absolute Position (good for drawing).
    // For panning, we specifically need the Movement Delta.
    // We hook the raw client event here to shift the global camera.
    this.client.onCursorMove((payload, id) => {
      const user = this._cursors.get(id);
      
      // If user is in Pan Mode and "Clutched" (holding click/touch)
      if (user && user.data.tool === 'pan' && user.data.isDragging) {
        const SENSITIVITY = 2.0;
        this.state.viewportX += (payload.deltaX || 0) * SENSITIVITY;
        this.state.viewportY += (payload.deltaY || 0) * SENSITIVITY;
        this._render();
      }
    });
  }

  /**
   * SDK Hook: Called whenever a user moves, connects, or disconnects.
   * We use this to record drawing points for active pens.
   */
  onPlayerUpdate(cursorMap, changedId) {
    const user = cursorMap.get(changedId);

    // Case: User Disconnected
    if (!user) {
      this._render();
      return;
    }

    // Case: New User (Initialize default data)
    if (!user.data.tool) {
      this.updateCursorData(changedId, { 
        tool: 'pen', 
        color: '#000000', 
        size: 4,
        isDragging: false 
      });
    }

    // Case: User is Drawing
    // If the "Clutch" is down and they have an active stroke ID
    if (user.data.isDragging && user.data.currentStrokeId) {
      const stroke = this.state.activeStrokes.get(user.data.currentStrokeId);
      if (stroke) {
        // Convert Screen Coordinates -> World Coordinates (subtract viewport)
        const worldX = user.x - this.state.viewportX;
        const worldY = user.y - this.state.viewportY;
        stroke.points.push({ x: worldX, y: worldY });
      }
    }

    this._render();
  }

  /**
   * SDK Hook: Handle Tool Changes and Stroke Lifecycle.
   */
  onCustomEvent(name, payload, id) {
    // 1. Tool State Updates
    // We simply update the User's data bag. The SDK persists this state.
    if (name === 'draw:mode') {
      this.updateCursorData(id, { tool: payload.mode, isDragging: false });
      // If they were typing, commit the text when switching tools
      if (this._cursors.get(id).data.activeText) this._commitText(this._cursors.get(id));
    }
    if (name === 'draw:color') this.updateCursorData(id, { color: payload.color });
    if (name === 'draw:size')  this.updateCursorData(id, { size: payload.lineWidth });

    // 2. Stroke Lifecycle (Clutch Down/Up)
    if (name === 'draw:strokeStart') {
      const user = this._cursors.get(id);
      this.updateCursorData(id, { isDragging: true });

      if (user.data.tool === 'type') {
        this._startTyping(user);
      } else if (user.data.tool !== 'pan') {
        this._startStroke(user, payload.id);
      }
    }

    if (name === 'draw:strokeEnd') {
      this.updateCursorData(id, { isDragging: false });
      this._endStroke(payload.id);
    }

    // 3. Global Actions
    if (name === 'draw:clear') {
      this.state.strokes = [];
      this.state.texts = [];
      this.state.activeStrokes.clear();
    }
    if (name === 'draw:undo') {
      if (this.state.strokes.length) this.state.strokes.pop();
      else if (this.state.texts.length) this.state.texts.pop();
    }

    this._render();
  }

  /**
   * SDK Hook: Handle Keyboard Input (Per-User).
   */
  onKeyPress({ key }, id) {
    const user = this._cursors.get(id);
    if (!user || user.data.tool !== 'type') return;

    // Auto-start typing session if they just start typing without clicking
    if (!user.data.activeText) {
      if (key.length === 1) this._startTyping(user);
      else return;
    }

    const textObj = user.data.activeText;

    if (key === 'Backspace') {
      textObj.content = textObj.content.slice(0, -1);
    } else if (key === 'Enter') {
      this._commitText(user);
    } else if (key.length === 1) {
      textObj.content += key;
    }
    this._render();
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  _startStroke(user, strokeId) {
    const isEraser = user.data.tool === 'erase';
    
    // Create stroke object in World Coordinates
    const stroke = {
      id: strokeId,
      ownerId: user.id,
      mode: isEraser ? 'eraser' : 'pen',
      color: isEraser ? '#ffffff' : user.data.color,
      lineWidth: isEraser ? (user.data.size * 4) : user.data.size,
      points: [{ 
        x: user.x - this.state.viewportX, 
        y: user.y - this.state.viewportY 
      }]
    };

    this.state.activeStrokes.set(strokeId, stroke);
    this.updateCursorData(user.id, { currentStrokeId: strokeId });
  }

  _endStroke(strokeId) {
    const stroke = this.state.activeStrokes.get(strokeId);
    if (stroke) {
      this.state.strokes.push(stroke);
      this.state.activeStrokes.delete(strokeId);
    }
  }

  _startTyping(user) {
    // If already typing elsewhere, commit that first
    if (user.data.activeText) this._commitText(user);

    // Logic: Try to select existing text at cursor location (Hit Test)
    // (Omitted deep hit-test logic for brevity, but this is where it goes)
    
    // Start new text block
    const newText = {
      x: user.x - this.state.viewportX,
      y: user.y - this.state.viewportY,
      color: user.data.color,
      fontSize: 20,
      content: ''
    };
    
    this.updateCursorData(user.id, { activeText: newText });
  }

  _commitText(user) {
    const text = user.data.activeText;
    if (text && text.content.trim()) {
      this.state.texts.push(text);
    }
    this.updateCursorData(user.id, { activeText: null });
  }
}