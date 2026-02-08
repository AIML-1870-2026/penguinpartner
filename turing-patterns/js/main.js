// Main entry point — initializes WebGPU and wires everything together
import { initGPU } from './gpu.js';
import { Simulation } from './simulation.js';
import { Renderer } from './renderer.js';
import { Brush } from './brush.js';
import { UI } from './ui.js';
import { presets } from './presets.js';

class App {
    constructor() {
        this.running = true;
        this.stepsPerFrame = 8;
        this.frameCount = 0;
        this.currentPreset = null;
        this.currentModel = null;
    }

    async init() {
        const canvas = document.getElementById('sim-canvas');

        try {
            const { device, context, format } = await initGPU(canvas);
            this.device = device;
            this.context = context;

            // Size canvas to container
            const container = canvas.parentElement;
            const size = Math.min(container.clientWidth, container.clientHeight) || 512;
            canvas.width = size;
            canvas.height = size;

            this.simulation = new Simulation(device, 512, 512);
            this.renderer = new Renderer(device, context, format, this.simulation);

            this.brush = new Brush(canvas, this.simulation, () => {
                return this.simulation._defaultValues(this.currentModel);
            });

            this.ui = new UI(this);

            // Load first preset
            this.loadPreset(0);

            // Start loop
            this._lastTime = performance.now();
            this._fpsFrames = 0;
            this._fpsTime = 0;
            this._measuredFPS = 0;
            this._animate();

        } catch (err) {
            if (err.message === 'NO_WEBGPU') {
                this._showFallback();
            } else {
                console.error(err);
                this._showFallback();
            }
        }
    }

    _showFallback() {
        document.getElementById('app-container').innerHTML = `
            <div class="fallback">
                <h1>WebGPU Required</h1>
                <p>This app requires WebGPU to run the GPU-accelerated simulation.</p>
                <p>Please use <strong>Chrome 113+</strong> or <strong>Edge 113+</strong>.</p>
                <p><a href="https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API#browser_compatibility"
                      target="_blank">Check browser compatibility</a></p>
            </div>
        `;
    }

    loadPreset(index) {
        const preset = presets[index];
        if (!preset) return;

        this.currentPreset = preset;
        this.currentModel = preset.model;

        this.simulation.setModel(preset.model);
        this.simulation.updateParams(preset.model, preset.params);
        this.simulation.initState(preset.init, preset.model);

        this.renderer.setColormap(preset.colormap);
        this.renderer.setDisplayParams(
            preset.display,
            preset.displayRange[0],
            preset.displayRange[1]
        );

        this.ui.syncUI(preset, index);
        this.frameCount = 0;
    }

    switchModel(modelName) {
        // Find first preset for this model
        const idx = presets.findIndex(p => p.model === modelName);
        if (idx >= 0) this.loadPreset(idx);
    }

    updateParams(params) {
        this.simulation.updateParams(this.currentModel, params);
    }

    setDisplayChannel(channel) {
        const range = this.currentPreset?.displayRange || [0, 1];
        this.renderer.setDisplayParams(channel, range[0], range[1]);
    }

    setColormap(name) {
        this.renderer.setColormap(name);
    }

    resetSimulation() {
        if (this.currentPreset) {
            this.simulation.initState(this.currentPreset.init, this.currentModel);
            this.frameCount = 0;
        }
    }

    clearSimulation() {
        this.simulation.initState('center-seed', this.currentModel);
        this.frameCount = 0;
    }

    singleStep() {
        const encoder = this.device.createCommandEncoder();
        this.simulation.step(encoder, 1);
        this.renderer.render(encoder);
        this.device.queue.submit([encoder.finish()]);
        this.frameCount++;
    }

    changeResolution(size) {
        this.simulation.resize(size, size);
        this.renderer.rebuildBindGroups();
        this.simulation.setModel(this.currentModel);
        this.simulation.updateParams(this.currentModel, this.currentPreset.params);
        this.simulation.initState(this.currentPreset.init, this.currentModel);
        this.renderer.setDisplayParams(
            this.currentPreset.display,
            this.currentPreset.displayRange[0],
            this.currentPreset.displayRange[1]
        );
        this.frameCount = 0;
    }

    _animate() {
        const now = performance.now();
        const dt = now - this._lastTime;
        this._lastTime = now;
        this._fpsTime += dt;
        this._fpsFrames++;
        if (this._fpsTime >= 500) {
            this._measuredFPS = Math.round(this._fpsFrames / (this._fpsTime / 1000));
            this._fpsTime = 0;
            this._fpsFrames = 0;
            this.ui.updateStatus(this._measuredFPS, this.frameCount, this.simulation.width);
        }

        if (this.running) {
            const encoder = this.device.createCommandEncoder();
            this.simulation.step(encoder, this.stepsPerFrame);
            this.renderer.render(encoder);
            this.device.queue.submit([encoder.finish()]);
            this.frameCount++;
        }

        requestAnimationFrame(() => this._animate());
    }
}

// Boot
const app = new App();
app.init();
