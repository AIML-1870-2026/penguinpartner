// controls.js - Wire all UI elements to the simulation and renderer
window.TuringApp = window.TuringApp || {};

TuringApp.Controls = {
    init(sim, renderer, interaction, appState) {
        const presets = TuringApp.PRESETS;

        // --- Preset grid ---
        const presetItems = document.querySelectorAll('.preset-item');
        presetItems.forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.preset);
                const preset = presets[idx];
                sim.feedRate = preset.f;
                sim.killRate = preset.k;

                // Update UI
                presetItems.forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                document.getElementById('f-slider').value = preset.f;
                document.getElementById('k-slider').value = preset.k;
                document.getElementById('f-value').textContent = preset.f.toFixed(4);
                document.getElementById('k-value').textContent = preset.k.toFixed(4);
            });
        });

        // --- Breeding controls ---
        const parentA = document.getElementById('parent-a-select');
        const parentB = document.getElementById('parent-b-select');
        presets.forEach((p, i) => {
            parentA.appendChild(new Option(p.name, i, false, i === 0));
            parentB.appendChild(new Option(p.name, i, false, i === 1));
        });

        const blendSlider = document.getElementById('blend-slider');
        const blendValue = document.getElementById('blend-value');
        blendSlider.addEventListener('input', () => {
            blendValue.textContent = blendSlider.value + '%';
        });

        document.getElementById('breed-btn').addEventListener('click', () => {
            const a = presets[parseInt(parentA.value)];
            const b = presets[parseInt(parentB.value)];
            const t = parseInt(blendSlider.value) / 100;
            const blended = TuringApp.Breeding.blend(a, b, t);

            sim.feedRate = blended.f;
            sim.killRate = blended.k;
            sim.reset();

            // Update sliders to reflect blended values
            document.getElementById('f-slider').value = blended.f;
            document.getElementById('k-slider').value = blended.k;
            document.getElementById('f-value').textContent = blended.f.toFixed(4);
            document.getElementById('k-value').textContent = blended.k.toFixed(4);

            // Clear active preset highlight
            presetItems.forEach(el => el.classList.remove('active'));
        });

        // --- Color theme ---
        document.getElementById('theme-select').addEventListener('change', e => {
            renderer.setTheme(e.target.value);
        });

        // --- Manual parameter sliders ---
        const fSlider = document.getElementById('f-slider');
        const kSlider = document.getElementById('k-slider');
        const fValue = document.getElementById('f-value');
        const kValue = document.getElementById('k-value');

        fSlider.addEventListener('input', () => {
            sim.feedRate = parseFloat(fSlider.value);
            fValue.textContent = parseFloat(fSlider.value).toFixed(4);
            presetItems.forEach(el => el.classList.remove('active'));
        });

        kSlider.addEventListener('input', () => {
            sim.killRate = parseFloat(kSlider.value);
            kValue.textContent = parseFloat(kSlider.value).toFixed(4);
            presetItems.forEach(el => el.classList.remove('active'));
        });

        // --- Play / Pause ---
        const playPauseBtn = document.getElementById('play-pause-btn');
        playPauseBtn.addEventListener('click', () => {
            const running = !appState.getRunning();
            appState.setRunning(running);
            playPauseBtn.textContent = running ? 'Pause' : 'Play';
        });

        // --- Reset ---
        document.getElementById('reset-btn').addEventListener('click', () => {
            sim.reset();
        });

        // --- Export ---
        document.getElementById('export-btn').addEventListener('click', () => {
            const scale = parseInt(document.getElementById('export-scale').value);
            TuringApp.Export.exportPNG(renderer, scale);
        });

        // --- Keyboard shortcuts ---
        document.addEventListener('keydown', e => {
            // Ignore when focused on an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    playPauseBtn.click();
                    break;
                case 'r':
                case 'R':
                    sim.reset();
                    break;
                case 'e':
                case 'E': {
                    const scale = parseInt(document.getElementById('export-scale').value);
                    TuringApp.Export.exportPNG(renderer, scale);
                    break;
                }
                default:
                    // Number keys 1-9 load presets (0-indexed)
                    if (e.key >= '1' && e.key <= '9') {
                        const idx = parseInt(e.key) - 1;
                        if (idx < presetItems.length) {
                            presetItems[idx].click();
                        }
                    }
                    break;
            }
        });
    }
};
