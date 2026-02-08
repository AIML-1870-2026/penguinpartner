// UI — wire DOM controls to simulation / renderer / brush
import { presets, presetsByModel } from './presets.js';
import { colormapNames } from './colormaps.js';

const MODELS = [
    { id: 'gray-scott', label: 'Gray-Scott' },
    { id: 'fitzhugh-nagumo', label: 'FitzHugh-Nagumo' },
    { id: 'brusselator', label: 'Brusselator' },
];

// Parameter definitions per model  [key, label, min, max, step, defaultKey]
const MODEL_PARAMS = {
    'gray-scott': [
        ['F', 'Feed rate (F)', 0, 0.1, 0.001],
        ['k', 'Kill rate (k)', 0, 0.1, 0.001],
        ['Du', 'Diffusion U', 0.05, 0.5, 0.005],
        ['Dv', 'Diffusion V', 0.01, 0.25, 0.005],
        ['dt', 'Time step', 0.1, 2.0, 0.1],
    ],
    'fitzhugh-nagumo': [
        ['stimulus', 'Stimulus (I)', -0.5, 0.5, 0.01],
        ['epsilon', 'Recovery (e)', 0.001, 0.1, 0.001],
        ['a1', 'Coupling a1', 0, 3, 0.05],
        ['a0', 'Offset a0', -1, 1, 0.05],
        ['Du', 'Diffusion u', 0.01, 1, 0.01],
        ['Dv', 'Diffusion v', 0, 1, 0.01],
        ['dt', 'Time step', 0.01, 0.5, 0.005],
    ],
    'brusselator': [
        ['A_feed', 'Feed A', 0.5, 5, 0.1],
        ['B_feed', 'Feed B', 0.5, 12, 0.1],
        ['Du', 'Diffusion U', 0.5, 5, 0.1],
        ['Dv', 'Diffusion V', 0.5, 20, 0.5],
        ['dt', 'Time step', 0.001, 0.05, 0.001],
    ],
};

export class UI {
    constructor(app) {
        this.app = app;
        this.currentParams = {};
        this._buildModelSelector();
        this._buildPresetSelector();
        this._buildTransport();
        this._buildSpeedSlider();
        this._buildParameterPanel();
        this._buildBrushPanel();
        this._buildVisualizationPanel();
        this._buildGridPanel();
        this._buildKeyboard();
    }

    // ── Model selector ──────────────────────────
    _buildModelSelector() {
        const sel = document.getElementById('model-select');
        MODELS.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.label;
            sel.appendChild(opt);
        });
        sel.addEventListener('change', () => {
            this.app.switchModel(sel.value);
            this._updatePresetList(sel.value);
            this._buildParameterSliders(sel.value);
        });
    }

    // ── Preset selector ─────────────────────────
    _buildPresetSelector() {
        this.presetSel = document.getElementById('preset-select');
        this.presetSel.addEventListener('change', () => {
            const idx = parseInt(this.presetSel.value, 10);
            if (!isNaN(idx)) this.app.loadPreset(idx);
        });
    }

    _updatePresetList(modelName) {
        const sel = this.presetSel;
        sel.innerHTML = '';
        presets.forEach((p, i) => {
            if (p.model !== modelName) return;
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = p.name;
            sel.appendChild(opt);
        });
    }

    // ── Transport controls ──────────────────────
    _buildTransport() {
        const playBtn = document.getElementById('play-btn');
        const stepBtn = document.getElementById('step-btn');

        playBtn.addEventListener('click', () => {
            this.app.running = !this.app.running;
            playBtn.textContent = this.app.running ? '\u23F8' : '\u25B6';
            playBtn.title = this.app.running ? 'Pause' : 'Play';
        });

        stepBtn.addEventListener('click', () => {
            this.app.running = false;
            playBtn.textContent = '\u25B6';
            this.app.singleStep();
        });
    }

    // ── Speed slider ────────────────────────────
    _buildSpeedSlider() {
        const slider = document.getElementById('speed-slider');
        const display = document.getElementById('speed-value');
        slider.addEventListener('input', () => {
            this.app.stepsPerFrame = parseInt(slider.value, 10);
            display.textContent = slider.value;
        });
    }

    // ── Parameter sliders ───────────────────────
    _buildParameterPanel() {
        this.paramContainer = document.getElementById('param-sliders');
    }

    _buildParameterSliders(modelName) {
        const container = this.paramContainer;
        container.innerHTML = '';
        const defs = MODEL_PARAMS[modelName] || [];

        defs.forEach(([key, label, min, max, step]) => {
            const val = this.currentParams[key] ?? ((min + max) / 2);

            const group = document.createElement('div');
            group.className = 'param-group';

            const lbl = document.createElement('label');
            const span = document.createElement('span');
            span.className = 'param-val';
            span.textContent = val.toFixed(key === 'dt' ? 2 : 3);
            lbl.textContent = label + ' ';
            lbl.appendChild(span);

            const input = document.createElement('input');
            input.type = 'range';
            input.min = min;
            input.max = max;
            input.step = step;
            input.value = val;

            input.addEventListener('input', () => {
                const v = parseFloat(input.value);
                this.currentParams[key] = v;
                span.textContent = v.toFixed(key === 'dt' ? 2 : 3);
                this.app.updateParams(this.currentParams);
            });

            group.appendChild(lbl);
            group.appendChild(input);
            container.appendChild(group);
        });

        // Randomize button
        const randBtn = document.createElement('button');
        randBtn.className = 'ctrl-btn';
        randBtn.textContent = 'Randomize';
        randBtn.addEventListener('click', () => {
            defs.forEach(([key, , min, max]) => {
                this.currentParams[key] = min + Math.random() * (max - min);
            });
            this._buildParameterSliders(modelName);
            this.app.updateParams(this.currentParams);
        });
        container.appendChild(randBtn);
    }

    // ── Brush panel ─────────────────────────────
    _buildBrushPanel() {
        const sizeSlider = document.getElementById('brush-size');
        const sizeDisplay = document.getElementById('brush-size-val');
        sizeSlider.addEventListener('input', () => {
            this.app.brush.radius = parseInt(sizeSlider.value, 10);
            sizeDisplay.textContent = sizeSlider.value + 'px';
        });

        document.querySelectorAll('input[name="brush-chem"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.app.brush.chemical = parseInt(radio.value, 10);
            });
        });

        const valSlider = document.getElementById('brush-value');
        const valDisplay = document.getElementById('brush-val-display');
        valSlider.addEventListener('input', () => {
            this.app.brush.value = parseFloat(valSlider.value);
            valDisplay.textContent = parseFloat(valSlider.value).toFixed(2);
        });
    }

    // ── Visualization panel ─────────────────────
    _buildVisualizationPanel() {
        document.querySelectorAll('input[name="display-ch"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.app.setDisplayChannel(parseInt(radio.value, 10));
            });
        });

        const cmSel = document.getElementById('colormap-select');
        colormapNames.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            cmSel.appendChild(opt);
        });
        cmSel.addEventListener('change', () => {
            this.app.setColormap(cmSel.value);
        });
    }

    // ── Grid panel ──────────────────────────────
    _buildGridPanel() {
        document.getElementById('res-select').addEventListener('change', (e) => {
            const size = parseInt(e.target.value, 10);
            this.app.changeResolution(size);
        });

        document.getElementById('reset-btn').addEventListener('click', () => {
            this.app.resetSimulation();
        });

        document.getElementById('clear-btn').addEventListener('click', () => {
            this.app.clearSimulation();
        });
    }

    // ── Keyboard shortcuts ──────────────────────
    _buildKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    document.getElementById('play-btn').click();
                    break;
                case 'r':
                    this.app.resetSimulation();
                    break;
                case 'ArrowRight':
                    document.getElementById('step-btn').click();
                    break;
            }
        });
    }

    // ── External updates ────────────────────────
    setParams(params) {
        this.currentParams = { ...params };
    }

    syncUI(preset, presetIndex) {
        document.getElementById('model-select').value = preset.model;
        this._updatePresetList(preset.model);
        this.presetSel.value = presetIndex;
        this.setParams(preset.params);
        this._buildParameterSliders(preset.model);

        document.getElementById('colormap-select').value = preset.colormap;

        // Sync display channel radio
        document.querySelectorAll('input[name="display-ch"]').forEach(r => {
            r.checked = parseInt(r.value, 10) === preset.display;
        });
    }

    updateStatus(fps, frameCount, width) {
        const el = document.getElementById('status-bar');
        el.textContent = `${width}\u00D7${width} | ${fps} fps | ${this.app.stepsPerFrame} steps/frame | Frame ${frameCount}`;
    }
}
