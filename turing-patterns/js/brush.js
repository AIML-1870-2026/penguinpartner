// Brush — canvas mouse interaction for painting/erasing

export class Brush {
    constructor(canvas, simulation, getModelDefaults) {
        this.canvas = canvas;
        this.simulation = simulation;
        this.getModelDefaults = getModelDefaults;

        this.radius = 15;
        this.chemical = 1; // 0=U, 1=V, 2=both
        this.value = 1.0;
        this.painting = false;
        this.erasing = false;

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);

        canvas.addEventListener('pointerdown', this._onPointerDown);
        canvas.addEventListener('pointermove', this._onPointerMove);
        canvas.addEventListener('pointerup', this._onPointerUp);
        canvas.addEventListener('pointerleave', this._onPointerUp);
        canvas.addEventListener('contextmenu', e => e.preventDefault());
    }

    _canvasToGrid(e) {
        const rect = this.canvas.getBoundingClientRect();
        const sim = this.simulation;
        const x = (e.clientX - rect.left) / rect.width * sim.width;
        const y = (e.clientY - rect.top) / rect.height * sim.height;
        return { x, y };
    }

    _paint(e) {
        const { x, y } = this._canvasToGrid(e);
        const defaults = this.getModelDefaults();
        this.simulation.applyBrush(
            x, y, this.radius, this.value,
            this.chemical, this.erasing,
            defaults[0], defaults[1]
        );
    }

    _onPointerDown(e) {
        if (e.button === 0) {
            this.painting = true;
            this.erasing = false;
        } else if (e.button === 2) {
            this.painting = true;
            this.erasing = true;
        }
        if (this.painting) {
            this.canvas.setPointerCapture(e.pointerId);
            this._paint(e);
        }
    }

    _onPointerMove(e) {
        if (!this.painting) return;
        this._paint(e);
    }

    _onPointerUp() {
        this.painting = false;
        this.erasing = false;
    }
}
