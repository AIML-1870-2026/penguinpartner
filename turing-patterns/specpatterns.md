# Turing Patterns Explorer — Specification

## Overview

A web-based, interactive reaction-diffusion simulator that lets users explore Turing pattern formation in real time. The app supports multiple mathematical models, runs on the GPU via WebGPU compute shaders, and provides an intuitive interface for painting initial conditions, tweaking parameters, and browsing a curated library of presets.

---

## 1. Supported Models

### 1.1 Gray-Scott

The classic two-chemical model. Chemicals **U** and **V** with reactions:

```
∂U/∂t = Dᵤ∇²U - UV² + F(1 - U)
∂V/∂t = Dᵥ∇²V + UV² - (F + k)V
```

**Parameters:**
| Parameter | Symbol | Range | Default |
|-----------|--------|-------|---------|
| Feed rate | F | 0.0 – 0.1 | 0.055 |
| Kill rate | k | 0.0 – 0.1 | 0.062 |
| Diffusion U | Dᵤ | 0.05 – 0.5 | 0.21 |
| Diffusion V | Dᵥ | 0.01 – 0.25 | 0.105 |
| Time step | dt | 0.1 – 2.0 | 1.0 |

### 1.2 FitzHugh-Nagumo

An excitable medium model producing spiral waves and labyrinthine patterns:

```
∂u/∂t = Dᵤ∇²u + u - u³ - v + I
∂v/∂t = Dᵥ∇²v + ε(u - a₁v - a₀)
```

**Parameters:**
| Parameter | Symbol | Range | Default |
|-----------|--------|-------|---------|
| Stimulus | I | -0.5 – 0.5 | 0.0 |
| Recovery rate | ε | 0.001 – 0.1 | 0.01 |
| Coupling a₁ | a₁ | 0.0 – 3.0 | 1.0 |
| Offset a₀ | a₀ | -1.0 – 1.0 | 0.0 |
| Diffusion u | Dᵤ | 0.01 – 1.0 | 0.2 |
| Diffusion v | Dᵥ | 0.0 – 1.0 | 0.05 |
| Time step | dt | 0.01 – 0.5 | 0.05 |

### 1.3 Brusselator

A chemical oscillator that produces spots, stripes, and hexagonal patterns:

```
∂U/∂t = Dᵤ∇²U + A - (B + 1)U + U²V
∂V/∂t = Dᵥ∇²V + BU - U²V
```

**Parameters:**
| Parameter | Symbol | Range | Default |
|-----------|--------|-------|---------|
| Feed A | A | 0.5 – 5.0 | 4.5 |
| Feed B | B | 0.5 – 12.0 | 8.0 |
| Diffusion U | Dᵤ | 0.5 – 5.0 | 1.0 |
| Diffusion V | Dᵥ | 0.5 – 20.0 | 8.0 |
| Time step | dt | 0.001 – 0.05 | 0.01 |

---

## 2. Architecture

### 2.1 Technology Stack

- **Rendering & Compute:** WebGPU (compute shaders for simulation, fragment shaders for visualization)
- **UI Framework:** Vanilla HTML/CSS/JS or lightweight framework (Preact or Lit). Keep dependencies minimal.
- **Build:** Vite for dev server and bundling
- **Language:** TypeScript throughout

### 2.2 Compute Pipeline

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Ping Buffer │────▶│ Compute Pass │────▶│  Pong Buffer  │
│  (read)      │     │ (WGSL shader)│     │  (write)      │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │ Render Pass   │
                                          │ (color map)   │
                                          └──────────────┘
```

- **Double-buffered** storage textures or buffers (ping-pong) for the simulation state.
- Each cell stores two `f32` values (U, V) — use `rgba32float` textures or structured buffers.
- The compute shader reads from buffer A, writes to buffer B; then they swap each step.
- A separate render pass samples the current state and maps it through a color LUT.
- Multiple simulation steps can run per animation frame (configurable "steps per frame" for speed).

### 2.3 Grid

- Default resolution: **512 × 512**
- Selectable: 256, 512, 1024 (larger sizes for powerful GPUs)
- Boundary conditions: **toroidal wrap** (wraps at edges)

---

## 3. User Interface

### 3.1 Layout

```
┌──────────────────────────────────────────────────────────┐
│  Header Bar:  [Model ▼]  [Preset ▼]  ⏵ ⏸ ⏭  Speed ━━━  │
├────────────────────────────────┬─────────────────────────┤
│                                │  CONTROL PANEL          │
│                                │                         │
│     SIMULATION CANVAS          │  ┌─ Parameters ───────┐ │
│     (fills available space)    │  │ F:  ━━━●━━━  0.055 │ │
│                                │  │ k:  ━━━●━━━  0.062 │ │
│                                │  │ Dᵤ: ━━━●━━━  0.21  │ │
│                                │  │ Dᵥ: ━━━●━━━  0.105 │ │
│                                │  │ dt: ━━━●━━━  1.0   │ │
│                                │  └────────────────────┘ │
│                                │                         │
│                                │  ┌─ Brush ────────────┐ │
│                                │  │ Size: ━━●━━  15px  │ │
│                                │  │ Chemical: [U] [V]   │ │
│                                │  │ Value: ━━●━━  1.0   │ │
│                                │  └────────────────────┘ │
│                                │                         │
│                                │  ┌─ Visualization ────┐ │
│                                │  │ Display: [U][V][UV] │ │
│                                │  │ Colormap: [▼ list]  │ │
│                                │  └────────────────────┘ │
│                                │                         │
│                                │  ┌─ Grid ─────────────┐ │
│                                │  │ Resolution: 512×512 │ │
│                                │  │ Steps/frame: ━●━  8 │ │
│                                │  │ [Reset] [Clear]     │ │
│                                │  └────────────────────┘ │
├────────────────────────────────┴─────────────────────────┤
│  Status: 512×512 │ 60 fps │ 8 steps/frame │ Frame 12480 │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Header Bar

- **Model selector** — dropdown: Gray-Scott, FitzHugh-Nagumo, Brusselator. Switching models resets the simulation and swaps the parameter panel.
- **Preset selector** — dropdown populated from the preset library (§4). Selecting a preset loads parameters + initial conditions.
- **Transport controls** — Play ⏵, Pause ⏸, Step ⏭ (advance one frame)
- **Speed slider** — controls steps-per-frame (1–32)

### 3.3 Control Panel (Right Sidebar)

**Width:** 280–320 px, collapsible on smaller screens.

#### Parameters Section
- One slider + numeric input per model parameter.
- Sliders update the simulation in real time (no apply button needed).
- A "Randomize" button that sets parameters to a random valid combination.

#### Brush Section
- **Size:** brush radius in pixels (1–50)
- **Chemical:** which channel to paint (U, V, or both)
- **Value:** the concentration value to paint (0.0–1.0)
- Left-click drag on canvas to paint.
- Right-click drag to erase (reset painted area to default state).

#### Visualization Section
- **Display channel:** U only, V only, or composite UV (default: V for Gray-Scott, U for FHN)
- **Colormap:** dropdown with options — Grayscale, Viridis, Inferno, Plasma, Magma, Turbo, Custom gradient
- Color maps are implemented as 1D LUT textures sampled in the fragment shader.

#### Grid Section
- **Resolution selector:** 256, 512, 1024
- **Steps per frame** slider (1–32, default 8)
- **Reset** — re-initialize with the current preset's initial conditions
- **Clear** — set entire grid to uniform default state

### 3.4 Canvas Interaction

| Input | Action |
|-------|--------|
| Left-click drag | Paint brush onto grid |
| Right-click drag | Erase (reset to default state) |
| Scroll wheel | Zoom in/out (optional, stretch goal) |
| Middle-click drag | Pan (optional, stretch goal) |

### 3.5 Status Bar

Displays: grid resolution, measured FPS, steps/frame, total frame count, current model name.

---

## 4. Preset Library

Each preset specifies: model, parameters, initial condition type, display channel, and color map.

### 4.1 Gray-Scott Presets

| Name | F | k | Description |
|------|---|---|-------------|
| Mitosis | 0.028 | 0.062 | Self-replicating spots |
| Coral Growth | 0.062 | 0.063 | Branching coral-like fingers |
| Maze | 0.029 | 0.057 | Labyrinthine winding channels |
| Spots | 0.035 | 0.065 | Stable spotted pattern |
| Stripes | 0.04 | 0.06 | Parallel stripe formation |
| Worms | 0.078 | 0.061 | Worm-like moving structures |
| Bubbles | 0.012 | 0.05 | Expanding bubble fronts |
| Chaos | 0.026 | 0.051 | Turbulent, chaotic dynamics |

### 4.2 FitzHugh-Nagumo Presets

| Name | Key params | Description |
|------|-----------|-------------|
| Spiral Waves | ε=0.01, a₁=1.0 | Classic spiral wave formation |
| Labyrinth | ε=0.05, a₁=2.0 | Static labyrinth pattern |
| Target Waves | ε=0.01, I=0.1 | Expanding concentric rings |

### 4.3 Brusselator Presets

| Name | A | B | Description |
|------|---|---|-------------|
| Hexagons | 4.5 | 8.0 | Honeycomb hex pattern |
| Stripes | 4.5 | 6.5 | Parallel stripe formation |
| Spots | 3.0 | 10.0 | Isolated spot array |

---

## 5. Initial Conditions

Each preset should specify one of these initialization strategies:

| Type | Description |
|------|-------------|
| `center-seed` | Uniform U=1, V=0 everywhere; small square of U=0.5, V=0.25 at center |
| `random-noise` | Uniform base with low-amplitude random perturbation across entire grid |
| `multi-seed` | Several small random seed points scattered across the grid |
| `gradient` | Linear gradient in one chemical (useful for FHN wave initiation) |

Users can always paint additional seeds on top of any initial condition.

---

## 6. Color Maps

Implemented as 256-entry 1D textures (RGBA). The fragment shader samples `colormap[concentration]`.

**Built-in maps:**
- Grayscale
- Viridis (perceptually uniform, blue-green-yellow)
- Inferno (black-red-yellow-white)
- Plasma (purple-pink-orange-yellow)
- Magma (black-purple-orange-yellow)
- Turbo (rainbow, high contrast)

**Custom gradient** (stretch goal): let user pick 2–4 color stops.

---

## 7. WebGPU Implementation Notes

### 7.1 Shader Structure

Each model gets its own WGSL compute shader. They share a common structure:

```wgsl
// Pseudocode structure for Gray-Scott compute shader
@group(0) @binding(0) var<storage, read>  stateIn  : array<vec2<f32>>;
@group(0) @binding(1) var<storage, read_write> stateOut : array<vec2<f32>>;
@group(0) @binding(2) var<uniform> params : SimParams;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
    // 1. Read U, V at this cell
    // 2. Compute 5-point Laplacian with toroidal wrap
    // 3. Apply reaction-diffusion equations
    // 4. Write new U, V to output buffer
}
```

### 7.2 Buffer Layout

- **State buffers (×2):** `array<vec2<f32>>` of size `width × height`. Each element is `(U, V)`.
- **Uniform buffer:** struct containing all model parameters, grid dimensions, dt.
- **Colormap texture:** `texture_1d<f32>`, 256 texels, RGBA.

### 7.3 Brush Painting

When the user paints, the app writes directly to the GPU buffer via `queue.writeBuffer()` for the affected region, or runs a small compute pass that stamps the brush shape.

### 7.4 Fallback

If WebGPU is unavailable, display a clear message: "This app requires WebGPU. Please use Chrome 113+ or Edge 113+." with a link to browser compatibility info. No Canvas2D fallback (performance would be unacceptable for the target experience).

---

## 8. Performance Targets

| Metric | Target |
|--------|--------|
| 512×512, 8 steps/frame | 60 fps on mid-range GPU |
| 1024×1024, 8 steps/frame | 30+ fps on mid-range GPU |
| Parameter update latency | < 1 frame (immediate) |
| Brush painting latency | < 16 ms response |

---

## 9. File Structure (Suggested)

```
turing-explorer/
├── index.html
├── src/
│   ├── main.ts              # Entry point, app initialization
│   ├── gpu.ts               # WebGPU device/context setup
│   ├── simulation.ts        # Simulation state, ping-pong, stepping
│   ├── renderer.ts          # Render pass, colormap application
│   ├── models/
│   │   ├── gray-scott.wgsl
│   │   ├── fitzhugh-nagumo.wgsl
│   │   └── brusselator.wgsl
│   ├── colormaps.ts         # LUT generation for each color map
│   ├── presets.ts           # Preset definitions
│   ├── brush.ts             # Brush/paint interaction logic
│   ├── ui.ts                # UI controls, event wiring
│   └── types.ts             # Shared TypeScript interfaces
├── style.css
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 10. Stretch Goals (Not in MVP)

These are nice-to-have features that can be added after the core is working:

- **Parameter space map** — a small F/k diagram overlay for Gray-Scott showing known pattern regions; the current parameter point is highlighted.
- **Zoom & pan** — scroll to zoom, middle-drag to pan the simulation canvas.
- **Export PNG** — save the current canvas frame as a PNG image.
- **Record GIF** — capture a short animation loop.
- **Custom gradient editor** — let users define their own color map with draggable stops.
- **Anisotropic diffusion** — directional diffusion rates for oriented patterns.
- **3D mode** — volumetric reaction-diffusion (major scope increase).

---

## 11. Browser Requirements

- **Required:** Chrome 113+, Edge 113+, Firefox Nightly (with WebGPU flag), Safari 18+ (partial)
- **Recommended:** Chrome or Edge latest stable
- The app must detect WebGPU availability and show a clear unsupported-browser message if absent.
