// WebGPU device and context initialization

export async function initGPU(canvas) {
    if (!navigator.gpu) {
        throw new Error('NO_WEBGPU');
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error('NO_WEBGPU');
    }

    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device,
        format,
        alphaMode: 'premultiplied',
    });

    return { device, context, format };
}
