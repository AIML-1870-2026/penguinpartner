// export.js - Export current canvas as a PNG at configurable resolution
window.TuringApp = window.TuringApp || {};

TuringApp.Export = {
    exportPNG(renderer, scale) {
        scale = scale || 1;
        const srcCanvas = renderer.canvas;
        const w = srcCanvas.width * scale;
        const h = srcCanvas.height * scale;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const ctx = tempCanvas.getContext('2d');

        // Nearest-neighbor upscale to preserve the pixel-art look
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(srcCanvas, 0, 0, w, h);

        const link = document.createElement('a');
        link.download = 'turing-pattern-' + Date.now() + '.png';
        link.href = tempCanvas.toDataURL('image/png');
        link.click();
    }
};
