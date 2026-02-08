// renderer.js - Maps simulation state to canvas pixels via color themes
window.TuringApp = window.TuringApp || {};

TuringApp.Renderer = class {
    constructor(canvas, simulation) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.simulation = simulation;
        this.imageData = this.ctx.createImageData(simulation.width, simulation.height);
        // Pre-built 256-entry lookup table: [r0, g0, b0, r1, g1, b1, ...]
        this.colorMap = new Uint8Array(256 * 3);
        this.setTheme('Blood Cells');
    }

    buildColorMap(colors) {
        const map = this.colorMap;
        const n = colors.length;
        for (let i = 0; i < 256; i++) {
            const t = i / 255;
            const seg = t * (n - 1);
            const idx = Math.min(Math.floor(seg), n - 2);
            const frac = seg - idx;
            const c1 = colors[idx];
            const c2 = colors[idx + 1];
            map[i * 3]     = Math.round(c1[0] + (c2[0] - c1[0]) * frac);
            map[i * 3 + 1] = Math.round(c1[1] + (c2[1] - c1[1]) * frac);
            map[i * 3 + 2] = Math.round(c1[2] + (c2[2] - c1[2]) * frac);
        }
    }

    setTheme(themeName) {
        const colors = TuringApp.COLOR_THEMES[themeName];
        if (colors) {
            this.buildColorMap(colors);
        }
    }

    render() {
        const b = this.simulation.b;
        const data = this.imageData.data;
        const cmap = this.colorMap;
        const size = this.simulation.size;

        for (let i = 0; i < size; i++) {
            const ci = Math.min(255, Math.max(0, Math.floor(b[i] * 255)));
            const ci3 = ci * 3;
            const i4 = i * 4;
            data[i4]     = cmap[ci3];
            data[i4 + 1] = cmap[ci3 + 1];
            data[i4 + 2] = cmap[ci3 + 2];
            data[i4 + 3] = 255;
        }

        this.ctx.putImageData(this.imageData, 0, 0);
    }
};
