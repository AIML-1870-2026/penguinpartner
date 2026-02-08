// Color map LUT generation — each returns Uint8Array(256 * 4) RGBA

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function interpolateStops(stops, count = 256) {
    const data = new Uint8Array(count * 4);
    for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        let s0 = 0;
        for (let j = 1; j < stops.length; j++) {
            if (stops[j][0] >= t) { s0 = j - 1; break; }
            if (j === stops.length - 1) { s0 = j - 1; }
        }
        const s1 = Math.min(s0 + 1, stops.length - 1);
        const range = stops[s1][0] - stops[s0][0];
        const local = range > 0 ? (t - stops[s0][0]) / range : 0;
        data[i * 4 + 0] = Math.round(lerp(stops[s0][1], stops[s1][1], local) * 255);
        data[i * 4 + 1] = Math.round(lerp(stops[s0][2], stops[s1][2], local) * 255);
        data[i * 4 + 2] = Math.round(lerp(stops[s0][3], stops[s1][3], local) * 255);
        data[i * 4 + 3] = 255;
    }
    return data;
}

// [position, r, g, b] — values in 0–1
const VIRIDIS_STOPS = [
    [0.00, 0.267, 0.004, 0.329],
    [0.13, 0.283, 0.141, 0.458],
    [0.25, 0.254, 0.265, 0.530],
    [0.38, 0.190, 0.407, 0.556],
    [0.50, 0.127, 0.566, 0.551],
    [0.63, 0.201, 0.683, 0.477],
    [0.75, 0.454, 0.768, 0.243],
    [0.88, 0.741, 0.843, 0.150],
    [1.00, 0.993, 0.906, 0.144],
];

const INFERNO_STOPS = [
    [0.00, 0.001, 0.000, 0.014],
    [0.14, 0.120, 0.028, 0.280],
    [0.29, 0.330, 0.060, 0.480],
    [0.43, 0.570, 0.090, 0.440],
    [0.57, 0.780, 0.210, 0.290],
    [0.71, 0.930, 0.410, 0.100],
    [0.86, 0.990, 0.660, 0.100],
    [1.00, 0.988, 0.998, 0.645],
];

const PLASMA_STOPS = [
    [0.00, 0.050, 0.030, 0.530],
    [0.14, 0.250, 0.010, 0.620],
    [0.29, 0.450, 0.004, 0.660],
    [0.43, 0.640, 0.050, 0.550],
    [0.57, 0.800, 0.160, 0.370],
    [0.71, 0.910, 0.320, 0.160],
    [0.86, 0.980, 0.530, 0.040],
    [1.00, 0.940, 0.975, 0.131],
];

const MAGMA_STOPS = [
    [0.00, 0.001, 0.000, 0.014],
    [0.14, 0.100, 0.030, 0.280],
    [0.29, 0.310, 0.060, 0.480],
    [0.43, 0.530, 0.100, 0.530],
    [0.57, 0.720, 0.200, 0.470],
    [0.71, 0.890, 0.360, 0.310],
    [0.86, 0.980, 0.600, 0.260],
    [1.00, 0.987, 0.991, 0.750],
];

const TURBO_STOPS = [
    [0.00, 0.190, 0.072, 0.232],
    [0.10, 0.079, 0.310, 0.866],
    [0.20, 0.048, 0.575, 0.997],
    [0.30, 0.090, 0.782, 0.811],
    [0.40, 0.234, 0.926, 0.547],
    [0.50, 0.489, 0.988, 0.300],
    [0.60, 0.750, 0.953, 0.136],
    [0.70, 0.930, 0.794, 0.052],
    [0.80, 0.988, 0.560, 0.030],
    [0.90, 0.905, 0.295, 0.075],
    [1.00, 0.640, 0.027, 0.069],
];

function grayscale() {
    return interpolateStops([
        [0.0, 0.0, 0.0, 0.0],
        [1.0, 1.0, 1.0, 1.0],
    ]);
}

export const colormapGenerators = {
    'Grayscale': grayscale,
    'Viridis': () => interpolateStops(VIRIDIS_STOPS),
    'Inferno': () => interpolateStops(INFERNO_STOPS),
    'Plasma': () => interpolateStops(PLASMA_STOPS),
    'Magma': () => interpolateStops(MAGMA_STOPS),
    'Turbo': () => interpolateStops(TURBO_STOPS),
};

export const colormapNames = Object.keys(colormapGenerators);
