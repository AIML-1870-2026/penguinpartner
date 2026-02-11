# Specification: Boid Ecosystem & Survival Lab

## 1. Executive Summary
A high-fidelity emergent behavior simulation based on Craig Reynolds' Boids algorithm, expanded into a survival ecosystem. The simulation features autonomous agents (Boids), a dynamic Predator, and user-defined Food sources, all governed by real-time weighted physics.

## 2. Technical Stack
- **Engine:** HTML5 Canvas (2D Context)
- **Math:** 2D Vector Physics (Euclidean distance, magnitude limiting, linear interpolation)
- **UI:** CSS Glassmorphism with real-time DOM-to-JS state synchronization.

---

## 3. The "Boid" Architecture

### 3.1 Primary Steering Forces
1.  **Separation ($w_s$):** Steer to avoid crowding neighbors.
2.  **Alignment ($w_a$):** Steer toward the average heading of neighbors.
3.  **Cohesion ($w_c$):** Steer toward the average position of neighbors.



### 3.2 Ecosystem Forces
1.  **Flee (Fear):** Calculate a vector away from the Predator position.
2.  **Seek (Hunger):** Calculate a vector toward the Food/Mouse position.
3.  **Dynamic Color Mapping:** Boid color is calculated per frame based on the proximity to the Predator:
    - $dist > 150px \to$ `Cyan (#00d4ff)`
    - $dist \to 15px \to$ `Magenta (#ff00ff)`

### 3.3 Death & Respawn
- **Hitbox Detection:** If $Distance(Boid, Predator) < 15px$, the boid is flagged as "Eaten".
- **State Reset:** Eaten boids are immediately re-initialized at a random location to maintain population density.

---

## 4. UI & Control Interface

| Component | Control Type | Range / Action |
| :--- | :--- | :--- |
| **Social Weights** | Sliders (x3) | 0.0 - 5.0 |
| **Predator Aggression**| Slider | 0.0 - 15.0 |
| **Food Lure** | Slider | 0.0 - 5.0 |
| **Boundary Mode** | Toggle | Wrap (Infinite) / Bounce (Box) |
| **Instrumentation** | Readouts | FPS, Eaten Count, Avg Neighbors |
