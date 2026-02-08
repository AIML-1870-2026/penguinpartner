// simulation.js - Gray-Scott reaction-diffusion engine
window.TuringApp = window.TuringApp || {};

TuringApp.Simulation = class {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.size = width * height;

        // Double-buffered chemical grids
        this.a = new Float32Array(this.size);
        this.b = new Float32Array(this.size);
        this.nextA = new Float32Array(this.size);
        this.nextB = new Float32Array(this.size);

        // Gray-Scott parameters
        this.feedRate = 0.038;
        this.killRate = 0.061;
        this.dA = 1.0;
        this.dB = 0.5;

        this.reset();
    }

    reset() {
        this.a.fill(1.0);
        this.b.fill(0.0);

        // Seed with random circular patches of chemical B
        const numSeeds = 15 + Math.floor(Math.random() * 15);
        for (let s = 0; s < numSeeds; s++) {
            const cx = Math.floor(Math.random() * this.width);
            const cy = Math.floor(Math.random() * this.height);
            const r = 3 + Math.floor(Math.random() * 5);
            this.addChemicalB(cx, cy, r);
        }
    }

    step() {
        const w = this.width;
        const h = this.height;
        const f = this.feedRate;
        const k = this.killRate;
        const dA = this.dA;
        const dB = this.dB;
        const a = this.a;
        const b = this.b;
        const nA = this.nextA;
        const nB = this.nextB;

        for (let y = 0; y < h; y++) {
            const yw = y * w;
            const upRow = ((y - 1 + h) % h) * w;
            const downRow = ((y + 1) % h) * w;

            for (let x = 0; x < w; x++) {
                const idx = yw + x;
                const left = yw + ((x - 1 + w) % w);
                const right = yw + ((x + 1) % w);
                const up = upRow + x;
                const down = downRow + x;

                // 5-point Laplacian
                const lapA = a[left] + a[right] + a[up] + a[down] - 4.0 * a[idx];
                const lapB = b[left] + b[right] + b[up] + b[down] - 4.0 * b[idx];

                const abb = a[idx] * b[idx] * b[idx];

                let newA = a[idx] + dA * lapA - abb + f * (1.0 - a[idx]);
                let newB = b[idx] + dB * lapB + abb - (k + f) * b[idx];

                // Clamp to [0, 1]
                nA[idx] = newA < 0 ? 0 : (newA > 1 ? 1 : newA);
                nB[idx] = newB < 0 ? 0 : (newB > 1 ? 1 : newB);
            }
        }

        // Swap buffers
        const tmpA = this.a;
        const tmpB = this.b;
        this.a = this.nextA;
        this.b = this.nextB;
        this.nextA = tmpA;
        this.nextB = tmpB;
    }

    addChemicalB(cx, cy, radius) {
        const r = Math.floor(radius);
        const rSq = r * r;
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (dx * dx + dy * dy <= rSq) {
                    const x = (Math.floor(cx) + dx + this.width) % this.width;
                    const y = (Math.floor(cy) + dy + this.height) % this.height;
                    const idx = y * this.width + x;
                    this.a[idx] = 0.0;
                    this.b[idx] = 1.0;
                }
            }
        }
    }
};
