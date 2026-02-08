// Simulation engine — WebGPU compute pipeline with ping-pong buffers
import { shaderMap, brushShader } from './shaders.js';

// Uniform buffer layout (64 bytes = 16 × f32):
// [0] width (u32)  [1] height (u32)  [2] dt  [3] F
// [4] k            [5] Du            [6] Dv  [7] stimulus
// [8] epsilon      [9] a1            [10] a0 [11] A_feed
// [12] B_feed      [13–15] padding

const PARAMS_SIZE = 64; // bytes
const BRUSH_PARAMS_SIZE = 48; // 12 × f32

export class Simulation {
    constructor(device, width, height) {
        this.device = device;
        this.width = width;
        this.height = height;
        this.cellCount = width * height;
        this.readBuffer = 0; // index of the buffer with current state

        this.currentModel = null;
        this.computePipelines = {};

        this._createBuffers();
        this._createBrushPipeline();
    }

    _createBuffers() {
        const device = this.device;
        const bufSize = this.cellCount * 2 * 4; // vec2<f32> per cell

        this.stateBuffers = [
            device.createBuffer({ size: bufSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }),
            device.createBuffer({ size: bufSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }),
        ];

        this.simParamsBuffer = device.createBuffer({
            size: PARAMS_SIZE,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.brushParamsBuffer = device.createBuffer({
            size: BRUSH_PARAMS_SIZE,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Compute bind group layout (shared by all models)
        this.computeBGL = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
            ],
        });

        // Two bind groups for ping-pong
        this.computeBindGroups = [
            device.createBindGroup({
                layout: this.computeBGL,
                entries: [
                    { binding: 0, resource: { buffer: this.stateBuffers[0] } },
                    { binding: 1, resource: { buffer: this.stateBuffers[1] } },
                    { binding: 2, resource: { buffer: this.simParamsBuffer } },
                ],
            }),
            device.createBindGroup({
                layout: this.computeBGL,
                entries: [
                    { binding: 0, resource: { buffer: this.stateBuffers[1] } },
                    { binding: 1, resource: { buffer: this.stateBuffers[0] } },
                    { binding: 2, resource: { buffer: this.simParamsBuffer } },
                ],
            }),
        ];
    }

    _getComputePipeline(modelName) {
        if (!this.computePipelines[modelName]) {
            const shaderCode = shaderMap[modelName];
            const module = this.device.createShaderModule({ code: shaderCode });
            this.computePipelines[modelName] = this.device.createComputePipeline({
                layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.computeBGL] }),
                compute: { module, entryPoint: 'main' },
            });
        }
        return this.computePipelines[modelName];
    }

    _createBrushPipeline() {
        const device = this.device;

        this.brushBGL = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
            ],
        });

        const module = device.createShaderModule({ code: brushShader });
        this.brushPipeline = device.createComputePipeline({
            layout: device.createPipelineLayout({ bindGroupLayouts: [this.brushBGL] }),
            compute: { module, entryPoint: 'main' },
        });

        // One brush bind group per state buffer
        this.brushBindGroups = [
            device.createBindGroup({
                layout: this.brushBGL,
                entries: [
                    { binding: 0, resource: { buffer: this.stateBuffers[0] } },
                    { binding: 1, resource: { buffer: this.brushParamsBuffer } },
                ],
            }),
            device.createBindGroup({
                layout: this.brushBGL,
                entries: [
                    { binding: 0, resource: { buffer: this.stateBuffers[1] } },
                    { binding: 1, resource: { buffer: this.brushParamsBuffer } },
                ],
            }),
        ];
    }

    setModel(modelName) {
        this.currentModel = modelName;
    }

    updateParams(modelName, params, width, height) {
        const buf = new ArrayBuffer(PARAMS_SIZE);
        const u32 = new Uint32Array(buf);
        const f32 = new Float32Array(buf);

        u32[0] = width || this.width;
        u32[1] = height || this.height;

        if (modelName === 'gray-scott') {
            f32[2] = params.dt;
            f32[3] = params.F;
            f32[4] = params.k;
            f32[5] = params.Du;
            f32[6] = params.Dv;
        } else if (modelName === 'fitzhugh-nagumo') {
            f32[2] = params.dt;
            f32[5] = params.Du;
            f32[6] = params.Dv;
            f32[7] = params.stimulus;
            f32[8] = params.epsilon;
            f32[9] = params.a1;
            f32[10] = params.a0;
        } else if (modelName === 'brusselator') {
            f32[2] = params.dt;
            f32[5] = params.Du;
            f32[6] = params.Dv;
            f32[11] = params.A_feed;
            f32[12] = params.B_feed;
        }

        this.device.queue.writeBuffer(this.simParamsBuffer, 0, buf);
    }

    // Encode N compute steps into the command encoder
    step(encoder, steps = 1) {
        const pipeline = this._getComputePipeline(this.currentModel);
        const wgX = Math.ceil(this.width / 8);
        const wgY = Math.ceil(this.height / 8);

        for (let i = 0; i < steps; i++) {
            const pass = encoder.beginComputePass();
            pass.setPipeline(pipeline);
            pass.setBindGroup(0, this.computeBindGroups[this.readBuffer]);
            pass.dispatchWorkgroups(wgX, wgY);
            pass.end();
            this.readBuffer = 1 - this.readBuffer;
        }
    }

    // Apply brush to the current readable state buffer
    applyBrush(cx, cy, radius, value, chemical, erase, defaultU, defaultV) {
        const buf = new ArrayBuffer(BRUSH_PARAMS_SIZE);
        const f32 = new Float32Array(buf);
        const u32 = new Uint32Array(buf);

        f32[0] = cx;
        f32[1] = cy;
        f32[2] = radius;
        f32[3] = value;
        u32[4] = chemical;
        u32[5] = this.width;
        u32[6] = this.height;
        u32[7] = erase ? 1 : 0;
        f32[8] = defaultU;
        f32[9] = defaultV;

        this.device.queue.writeBuffer(this.brushParamsBuffer, 0, buf);

        const encoder = this.device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(this.brushPipeline);
        pass.setBindGroup(0, this.brushBindGroups[this.readBuffer]);
        pass.dispatchWorkgroups(Math.ceil(this.width / 8), Math.ceil(this.height / 8));
        pass.end();
        this.device.queue.submit([encoder.finish()]);
    }

    // ── Initialization strategies ───────────────

    initState(type, modelName) {
        const w = this.width;
        const h = this.height;
        const data = new Float32Array(this.cellCount * 2);

        const defaults = this._defaultValues(modelName);
        const dU = defaults[0];
        const dV = defaults[1];

        // Fill with default values
        for (let i = 0; i < this.cellCount; i++) {
            data[i * 2] = dU;
            data[i * 2 + 1] = dV;
        }

        if (type === 'center-seed') {
            this._seedSquare(data, w, h, Math.floor(w / 2), Math.floor(h / 2), 10, modelName);
        } else if (type === 'random-noise') {
            for (let i = 0; i < this.cellCount; i++) {
                data[i * 2] += (Math.random() - 0.5) * 0.1;
                data[i * 2 + 1] += (Math.random() - 0.5) * 0.1;
            }
        } else if (type === 'multi-seed') {
            const numSeeds = 8 + Math.floor(Math.random() * 8);
            for (let s = 0; s < numSeeds; s++) {
                const sx = Math.floor(Math.random() * w);
                const sy = Math.floor(Math.random() * h);
                this._seedSquare(data, w, h, sx, sy, 4 + Math.floor(Math.random() * 4), modelName);
            }
        } else if (type === 'gradient') {
            for (let y = 0; y < h; y++) {
                const t = y / h;
                for (let x = 0; x < w; x++) {
                    const idx = (y * w + x) * 2;
                    data[idx] = dU + (t - 0.5) * 0.5;
                    data[idx + 1] = dV + (Math.random() - 0.5) * 0.05;
                }
            }
        }

        // Upload to buffer 0 and reset readBuffer
        this.device.queue.writeBuffer(this.stateBuffers[0], 0, data);
        this.readBuffer = 0;
    }

    _defaultValues(modelName) {
        if (modelName === 'gray-scott') return [1.0, 0.0];
        if (modelName === 'fitzhugh-nagumo') return [0.0, 0.0];
        if (modelName === 'brusselator') return [4.5, 1.78]; // A, B/A steady state approx
        return [1.0, 0.0];
    }

    _seedSquare(data, w, h, cx, cy, r, modelName) {
        const seedVals = modelName === 'gray-scott' ? [0.5, 0.25]
            : modelName === 'fitzhugh-nagumo' ? [1.0, 0.0]
            : [6.0, 3.0]; // brusselator — perturbed from steady state

        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                const x = ((cx + dx) % w + w) % w;
                const y = ((cy + dy) % h + h) % h;
                const idx = (y * w + x) * 2;
                data[idx] = seedVals[0];
                data[idx + 1] = seedVals[1];
            }
        }
    }

    // Resize grid (destroys state)
    resize(newWidth, newHeight) {
        this.stateBuffers[0].destroy();
        this.stateBuffers[1].destroy();
        this.width = newWidth;
        this.height = newHeight;
        this.cellCount = newWidth * newHeight;
        this._createBuffers();
        this._createBrushPipeline();
    }

    get currentStateBuffer() {
        return this.stateBuffers[this.readBuffer];
    }
}
