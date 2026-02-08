// breeding.js - Blend two preset parameter sets to create hybrid patterns
window.TuringApp = window.TuringApp || {};

TuringApp.Breeding = {
    /**
     * Linearly interpolate between two presets.
     * @param {object} presetA - { f, k }
     * @param {object} presetB - { f, k }
     * @param {number} t - Blend factor 0..1 (0 = all A, 1 = all B)
     * @returns {{ f: number, k: number }}
     */
    blend(presetA, presetB, t) {
        return {
            f: presetA.f + (presetB.f - presetA.f) * t,
            k: presetA.k + (presetB.k - presetA.k) * t
        };
    }
};
