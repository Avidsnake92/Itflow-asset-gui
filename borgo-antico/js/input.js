// ============================================================
// Borgo Antico — controlli touch (pan, pinch, tap)
// ============================================================
'use strict';

const Input = {
  pointers: new Map(),
  panStart: null,
  pinchStart: null,
  moved: false,

  init(canvas) {
    canvas.addEventListener('pointerdown', e => this.down(e));
    canvas.addEventListener('pointermove', e => this.move(e));
    canvas.addEventListener('pointerup', e => this.up(e));
    canvas.addEventListener('pointercancel', e => this.cancel(e));
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoomAt(e.clientX, e.clientY, factor);
    }, { passive: false });
    // niente doppio-tap zoom di Safari
    document.addEventListener('gesturestart', e => e.preventDefault());
  },

  down(e) {
    e.preventDefault();
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      this.moved = false;
      this.panStart = {
        px: e.clientX, py: e.clientY,
        camX: Renderer.cam.x, camY: Renderer.cam.y,
      };
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchStart = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        zoom: Renderer.cam.zoom,
      };
      this.panStart = null;
    }
  },

  move(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size === 1 && this.panStart) {
      const dx = e.clientX - this.panStart.px;
      const dy = e.clientY - this.panStart.py;
      if (Math.hypot(dx, dy) > 8) this.moved = true;
      if (this.moved) {
        Renderer.cam.x = this.panStart.camX - dx / Renderer.cam.zoom;
        Renderer.cam.y = this.panStart.camY - dy / Renderer.cam.zoom;
        Renderer.clampCamera();
      }
    } else if (this.pointers.size === 2 && this.pinchStart) {
      this.moved = true;
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
      const newZoom = this.pinchStart.zoom * (dist / this.pinchStart.dist);
      this.setZoomAt(midX, midY, newZoom);
    }
  },

  up(e) {
    const wasTap = this.pointers.size === 1 && !this.moved;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchStart = null;
    if (this.pointers.size === 0) this.panStart = null;
    if (wasTap) {
      const tile = Renderer.screenToTile(e.clientX, e.clientY);
      UI.onTapTile(tile.x, tile.y, e.clientX, e.clientY);
    }
  },

  cancel(e) {
    this.pointers.delete(e.pointerId);
    this.pinchStart = null;
    this.panStart = null;
  },

  zoomAt(sx, sy, factor) {
    this.setZoomAt(sx, sy, Renderer.cam.zoom * factor);
  },

  // zoom mantenendo fermo il punto (sx, sy) sullo schermo
  setZoomAt(sx, sy, newZoom) {
    const R = Renderer;
    newZoom = Math.max(R.minZoom, Math.min(R.maxZoom, newZoom));
    const wx = (sx - R.w / 2) / R.cam.zoom + R.cam.x;
    const wy = (sy - R.h / 2) / R.cam.zoom + R.cam.y;
    R.cam.zoom = newZoom;
    R.cam.x = wx - (sx - R.w / 2) / newZoom;
    R.cam.y = wy - (sy - R.h / 2) / newZoom;
    R.clampCamera();
  },
};
