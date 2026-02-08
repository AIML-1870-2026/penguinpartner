// WGSL Shader source code for all models, rendering, and brush

const PARAMS_STRUCT = `
struct SimParams {
    width: u32,
    height: u32,
    dt: f32,
    F: f32,
    k: f32,
    Du: f32,
    Dv: f32,
    stimulus: f32,
    epsilon: f32,
    a1: f32,
    a0: f32,
    A_feed: f32,
    B_feed: f32,
    _pad1: f32,
    _pad2: f32,
    _pad3: f32,
};
`;

const COMPUTE_HEADER = `
${PARAMS_STRUCT}

@group(0) @binding(0) var<storage, read> stateIn: array<vec2<f32>>;
@group(0) @binding(1) var<storage, read_write> stateOut: array<vec2<f32>>;
@group(0) @binding(2) var<uniform> params: SimParams;

fn idx(x: u32, y: u32) -> u32 {
    return y * params.width + x;
}

fn laplacian(x: u32, y: u32) -> vec2<f32> {
    let w = params.width;
    let h = params.height;
    let xp = (x + 1u) % w;
    let xm = (x + w - 1u) % w;
    let yp = (y + 1u) % h;
    let ym = (y + h - 1u) % h;
    let center = stateIn[idx(x, y)];
    return stateIn[idx(xp, y)] + stateIn[idx(xm, y)]
         + stateIn[idx(x, yp)] + stateIn[idx(x, ym)]
         - 4.0 * center;
}
`;

export const grayScottShader = `
${COMPUTE_HEADER}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let x = id.x;
    let y = id.y;
    if (x >= params.width || y >= params.height) { return; }

    let uv = stateIn[idx(x, y)];
    let U = uv.x;
    let V = uv.y;
    let lap = laplacian(x, y);

    let uvv = U * V * V;
    let newU = U + params.dt * (params.Du * lap.x - uvv + params.F * (1.0 - U));
    let newV = V + params.dt * (params.Dv * lap.y + uvv - (params.F + params.k) * V);

    stateOut[idx(x, y)] = vec2<f32>(clamp(newU, 0.0, 1.0), clamp(newV, 0.0, 1.0));
}
`;

export const fitzhughNagumoShader = `
${COMPUTE_HEADER}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let x = id.x;
    let y = id.y;
    if (x >= params.width || y >= params.height) { return; }

    let uv = stateIn[idx(x, y)];
    let u = uv.x;
    let v = uv.y;
    let lap = laplacian(x, y);

    let newU = u + params.dt * (params.Du * lap.x + u - u * u * u - v + params.stimulus);
    let newV = v + params.dt * (params.Dv * lap.y + params.epsilon * (u - params.a1 * v - params.a0));

    stateOut[idx(x, y)] = vec2<f32>(clamp(newU, -3.0, 3.0), clamp(newV, -3.0, 3.0));
}
`;

export const brusselatorShader = `
${COMPUTE_HEADER}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let x = id.x;
    let y = id.y;
    if (x >= params.width || y >= params.height) { return; }

    let uv = stateIn[idx(x, y)];
    let U = uv.x;
    let V = uv.y;
    let lap = laplacian(x, y);

    let u2v = U * U * V;
    let newU = U + params.dt * (params.Du * lap.x + params.A_feed - (params.B_feed + 1.0) * U + u2v);
    let newV = V + params.dt * (params.Dv * lap.y + params.B_feed * U - u2v);

    stateOut[idx(x, y)] = vec2<f32>(max(newU, 0.0), max(newV, 0.0));
}
`;

export const renderShader = `
struct RenderParams {
    width: u32,
    height: u32,
    displayChannel: u32,
    _pad: u32,
    minVal: f32,
    maxVal: f32,
    _pad2: f32,
    _pad3: f32,
};

@group(0) @binding(0) var<storage, read> state: array<vec2<f32>>;
@group(0) @binding(1) var colormapTex: texture_2d<f32>;
@group(0) @binding(2) var colormapSamp: sampler;
@group(0) @binding(3) var<uniform> rp: RenderParams;

struct VSOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vertexMain(@builtin(vertex_index) vi: u32) -> VSOut {
    var positions = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(3.0, -1.0),
        vec2<f32>(-1.0, 3.0),
    );
    var out: VSOut;
    out.pos = vec4<f32>(positions[vi], 0.0, 1.0);
    out.uv = (positions[vi] + 1.0) * 0.5;
    return out;
}

@fragment
fn fragmentMain(in: VSOut) -> @location(0) vec4<f32> {
    let x = min(u32(in.uv.x * f32(rp.width)), rp.width - 1u);
    let y = min(u32((1.0 - in.uv.y) * f32(rp.height)), rp.height - 1u);
    let cell = state[y * rp.width + x];

    var value: f32;
    if (rp.displayChannel == 0u) {
        value = cell.x;
    } else if (rp.displayChannel == 1u) {
        value = cell.y;
    } else {
        value = (cell.x + cell.y) * 0.5;
    }

    let norm = clamp((value - rp.minVal) / (rp.maxVal - rp.minVal), 0.0, 1.0);
    let color = textureSampleLevel(colormapTex, colormapSamp, vec2<f32>(norm, 0.5), 0.0);
    return color;
}
`;

export const brushShader = `
struct BrushParams {
    centerX: f32,
    centerY: f32,
    radius: f32,
    value: f32,
    chemical: u32,
    width: u32,
    height: u32,
    erase: u32,
    defaultU: f32,
    defaultV: f32,
    _pad1: f32,
    _pad2: f32,
};

@group(0) @binding(0) var<storage, read_write> state: array<vec2<f32>>;
@group(0) @binding(1) var<uniform> brush: BrushParams;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let x = id.x;
    let y = id.y;
    if (x >= brush.width || y >= brush.height) { return; }

    let dx = f32(x) - brush.centerX;
    let dy = f32(y) - brush.centerY;
    let dist = sqrt(dx * dx + dy * dy);

    if (dist <= brush.radius) {
        let i = y * brush.width + x;
        var uv = state[i];
        let strength = smoothstep(brush.radius, brush.radius * 0.3, dist);

        if (brush.erase == 1u) {
            uv = mix(uv, vec2<f32>(brush.defaultU, brush.defaultV), strength);
        } else {
            if (brush.chemical == 0u || brush.chemical == 2u) {
                uv.x = mix(uv.x, brush.value, strength);
            }
            if (brush.chemical == 1u || brush.chemical == 2u) {
                uv.y = mix(uv.y, brush.value, strength);
            }
        }
        state[i] = uv;
    }
}
`;

export const shaderMap = {
    'gray-scott': grayScottShader,
    'fitzhugh-nagumo': fitzhughNagumoShader,
    'brusselator': brusselatorShader,
};
