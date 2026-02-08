// Renderer — WebGPU render pipeline with colormap texture
import { renderShader } from './shaders.js';
import { colormapGenerators } from './colormaps.js';

const RENDER_PARAMS_SIZE = 32; // 8 × f32

export class Renderer {
    constructor(device, context, format, simulation) {
        this.device = device;
        this.context = context;
        this.format = format;
        this.simulation = simulation;

        this._createColormapTexture();
        this._createRenderPipeline();
        this.setColormap('Viridis');
        this.setDisplayParams(1, 0, 1); // channel=V, range 0–1
    }

    _createColormapTexture() {
        const device = this.device;

        this.colormapTexture = device.createTexture({
            size: [256, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });

        this.colormapSampler = device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
        });
    }

    _createRenderPipeline() {
        const device = this.device;

        this.renderParamsBuffer = device.createBuffer({
            size: RENDER_PARAMS_SIZE,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.renderBGL = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
                { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
                { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
            ],
        });

        const module = device.createShaderModule({ code: renderShader });
        this.renderPipeline = device.createRenderPipeline({
            layout: device.createPipelineLayout({ bindGroupLayouts: [this.renderBGL] }),
            vertex: { module, entryPoint: 'vertexMain' },
            fragment: {
                module,
                entryPoint: 'fragmentMain',
                targets: [{ format: this.format }],
            },
            primitive: { topology: 'triangle-list' },
        });

        this._createRenderBindGroups();
    }

    _createRenderBindGroups() {
        const device = this.device;
        const sim = this.simulation;
        const texView = this.colormapTexture.createView();

        this.renderBindGroups = [
            device.createBindGroup({
                layout: this.renderBGL,
                entries: [
                    { binding: 0, resource: { buffer: sim.stateBuffers[0] } },
                    { binding: 1, resource: texView },
                    { binding: 2, resource: this.colormapSampler },
                    { binding: 3, resource: { buffer: this.renderParamsBuffer } },
                ],
            }),
            device.createBindGroup({
                layout: this.renderBGL,
                entries: [
                    { binding: 0, resource: { buffer: sim.stateBuffers[1] } },
                    { binding: 1, resource: texView },
                    { binding: 2, resource: this.colormapSampler },
                    { binding: 3, resource: { buffer: this.renderParamsBuffer } },
                ],
            }),
        ];
    }

    setColormap(name) {
        const gen = colormapGenerators[name];
        if (!gen) return;
        const data = gen();
        this.device.queue.writeTexture(
            { texture: this.colormapTexture },
            data,
            { bytesPerRow: 256 * 4 },
            { width: 256, height: 1 },
        );
    }

    setDisplayParams(channel, minVal, maxVal) {
        const buf = new ArrayBuffer(RENDER_PARAMS_SIZE);
        const u32 = new Uint32Array(buf);
        const f32 = new Float32Array(buf);

        u32[0] = this.simulation.width;
        u32[1] = this.simulation.height;
        u32[2] = channel;
        u32[3] = 0; // padding
        f32[4] = minVal;
        f32[5] = maxVal;

        this.device.queue.writeBuffer(this.renderParamsBuffer, 0, buf);
    }

    render(encoder) {
        const textureView = this.context.getCurrentTexture().createView();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                loadOp: 'clear',
                storeOp: 'store',
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
            }],
        });
        pass.setPipeline(this.renderPipeline);
        pass.setBindGroup(0, this.renderBindGroups[this.simulation.readBuffer]);
        pass.draw(3);
        pass.end();
    }

    // Rebuild bind groups after simulation resize
    rebuildBindGroups() {
        this._createRenderBindGroups();
    }
}
