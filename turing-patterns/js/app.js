// app.js - Main entry point: wires simulation, renderer, interaction, and controls
window.addEventListener('DOMContentLoaded', () => {
    const GRID = 256;
    const STEPS_PER_FRAME = 8;

    // Canvas setup
    const canvas = document.getElementById('simulation-canvas');
    canvas.width = GRID;
    canvas.height = GRID;

    // Core modules
    const sim = new TuringApp.Simulation(GRID, GRID);
    const renderer = new TuringApp.Renderer(canvas, sim);
    const interaction = new TuringApp.Interaction(canvas, sim);

    // Apply default preset (Bubbles = index 6)
    const defaultPreset = TuringApp.PRESETS[6];
    sim.feedRate = defaultPreset.f;
    sim.killRate = defaultPreset.k;

    // App state
    let running = true;
    let lastTime = performance.now();
    let frameCount = 0;
    const fpsDisplay = document.getElementById('fps-display');

    // Animation loop
    function animate(time) {
        // FPS counter
        frameCount++;
        if (time - lastTime >= 1000) {
            fpsDisplay.textContent = 'FPS: ' + frameCount;
            frameCount = 0;
            lastTime = time;
        }

        if (running) {
            for (let i = 0; i < STEPS_PER_FRAME; i++) {
                sim.step();
            }
        }

        renderer.render();
        requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);

    // Wire up UI controls
    TuringApp.Controls.init(sim, renderer, interaction, {
        getRunning: () => running,
        setRunning: (v) => { running = v; }
    });
});
