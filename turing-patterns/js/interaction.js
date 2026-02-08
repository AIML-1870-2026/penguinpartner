// interaction.js - Mouse and touch interaction on the simulation canvas
window.TuringApp = window.TuringApp || {};

TuringApp.Interaction = class {
    constructor(canvas, simulation) {
        this.canvas = canvas;
        this.simulation = simulation;
        this.isDrawing = false;
        this.brushRadius = 5;
        this.setupEvents();
    }

    getSimCoords(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (clientX - rect.left) / rect.width * this.simulation.width,
            y: (clientY - rect.top) / rect.height * this.simulation.height
        };
    }

    paint(clientX, clientY) {
        const { x, y } = this.getSimCoords(clientX, clientY);
        this.simulation.addChemicalB(x, y, this.brushRadius);
    }

    setupEvents() {
        this.canvas.addEventListener('mousedown', e => {
            this.isDrawing = true;
            this.paint(e.clientX, e.clientY);
        });

        this.canvas.addEventListener('mousemove', e => {
            if (this.isDrawing) {
                this.paint(e.clientX, e.clientY);
            }
        });

        this.canvas.addEventListener('mouseup', () => this.isDrawing = false);
        this.canvas.addEventListener('mouseleave', () => this.isDrawing = false);

        // Touch support
        this.canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            this.isDrawing = true;
            const t = e.touches[0];
            this.paint(t.clientX, t.clientY);
        }, { passive: false });

        this.canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            if (this.isDrawing) {
                const t = e.touches[0];
                this.paint(t.clientX, t.clientY);
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', () => this.isDrawing = false);
    }
};
