# Neon Snake - Feature Enhancement Specification

## Project Overview
This document outlines the technical specifications for adding four major features to the Neon Snake game in sequential order. Each feature builds upon the previous implementation while maintaining code quality and game performance.

---

## Phase 1: Multiplayer Mode (2 Players, Same Screen)

### Objective
Enable two human players to compete simultaneously on the same game board, each controlling their own snake.

### Technical Requirements

#### 1.1 Game State Management
- **Snake Data Structure**
  - Create `player1Snake` and `player2Snake` arrays
  - Each snake maintains independent: position, direction, score, alive status
  - Track individual snake colors (Player 1: cyan, Player 2: magenta by default)

#### 1.2 Input Handling
- **Player 1 Controls:** Arrow Keys (existing)
  - ↑ ↓ ← → for directional movement
- **Player 2 Controls:** WASD Keys (new)
  - W (up), S (down), A (left), D (right)
- **Input Validation:** Prevent opposite direction moves for each player independently

#### 1.3 Collision Detection
- **Self-Collision:** Each snake dies when hitting itself
- **Snake-to-Snake Collision:**
  - Head-to-head collision: Both snakes die
  - Head-to-body collision: Moving snake dies, stationary snake survives
  - Body-to-body collision: No effect (snakes can cross)
- **Wall Collision:** Maintain existing behavior per game mode

#### 1.4 Food System
- **Single Food Item:** Both snakes compete for the same food
- **First Contact:** Snake that reaches food first gets points and grows
- **Respawn:** Immediate food respawn after consumption

#### 1.5 Scoring System
- **Individual Scores:** Track and display separate scores for each player
- **Win Conditions:**
  - Classic/Survival/Zen: Last snake alive wins
  - Speed Run: Highest score when timer expires
- **Tie Handling:** Display "TIE" if both snakes die simultaneously

#### 1.6 UI Updates
- **Score Display:**
  - Top-left: "Player 1: [score]"
  - Top-right: "Player 2: [score]"
- **Mode Selection:** Add "Multiplayer" option to mode dropdown
- **Game Over Screen:**
  - Display winner ("Player 1 Wins!", "Player 2 Wins!", or "TIE!")
  - Show both final scores

#### 1.7 Visual Enhancements
- **Snake Differentiation:**
  - Player 1: Cyan glow (#00ffff)
  - Player 2: Magenta glow (#ff00ff)
- **Head Indicators:** Add subtle visual marker to distinguish snake heads
- **Collision Effects:** Brief flash/particle effect on collisions

#### 1.8 Audio Enhancements
- **Distinct Sounds:**
  - Different pitch for each player eating food
  - Unique death sounds for each player
  - Victory fanfare for winner

---

## Phase 2: AI Opponent Mode

### Objective
Implement a computer-controlled snake that uses intelligent pathfinding to compete against the player.

### Technical Requirements

#### 2.1 AI Architecture
- **Difficulty Levels:**
  - Easy: Basic pathfinding, occasional random moves
  - Medium: Smart pathfinding with self-preservation
  - Hard: Optimal pathfinding, aggressive food competition

#### 2.2 Pathfinding Algorithm
- **A* Pathfinding Implementation:**
  - Heuristic: Manhattan distance to food
  - Cost function: Distance traveled + danger assessment
  - Update path every N frames (performance optimization)

#### 2.3 Decision Making
- **Priority System:**
  1. Avoid imminent death (walls, self-collision, player collision)
  2. Navigate toward food (when safe)
  3. Maintain central position (when no food available)
  4. Avoid trapping self in enclosed spaces

#### 2.4 Behavior Patterns
- **Easy AI:**
  - 70% pathfinding, 30% random valid moves
  - Reaction time delay: 200ms
  - Simple collision avoidance
  
- **Medium AI:**
  - 90% pathfinding, 10% strategic positioning
  - Reaction time delay: 100ms
  - Predicts player movement 1 step ahead
  
- **Hard AI:**
  - 100% optimal pathfinding
  - Reaction time delay: 50ms
  - Predicts player movement 2-3 steps ahead
  - Blocks player from food when possible

#### 2.5 UI Integration
- **Mode Selection:** Add "vs AI" mode with difficulty dropdown
- **Visual Indicators:**
  - AI snake uses orange/red color scheme
  - Display "AI: [difficulty]" on screen
  - Show AI "thinking" indicator (optional)

#### 2.6 Performance Optimization
- **Path Recalculation:** Only when necessary (food eaten, danger detected)
- **Decision Caching:** Store recent paths to reduce computation
- **Frame Limiting:** AI calculations run at max 30 FPS

---

## Phase 3: Procedural Level Generation

### Objective
Dynamically generate obstacle layouts and maze patterns that provide varied gameplay experiences.

### Technical Requirements

#### 3.1 Obstacle System
- **Obstacle Types:**
  - Static Walls: Immovable barriers that cause collision death
  - Spawn Timing: Generate at game start and/or at score intervals

#### 3.2 Generation Algorithms
- **Pattern Types:**
  1. **Scattered Obstacles:** Random wall placement (15-25% coverage)
  2. **Maze Pattern:** Recursive division or Prim's algorithm
  3. **Symmetric Patterns:** Mirror obstacles along center axis
  4. **Room-Based:** Divide grid into rooms with connecting passages

#### 3.3 Generation Constraints
- **Playability Rules:**
  - Always maintain path from any point to any other point
  - Minimum 3x3 clear space for snake starting positions
  - Food must be accessible from all positions
  - No obstacles within 5 tiles of starting positions

#### 3.4 Difficulty Scaling
- **Progressive Generation:**
  - Level 1-3: 10% obstacle coverage
  - Level 4-6: 20% obstacle coverage
  - Level 7+: 30% obstacle coverage
  - Density increases with score milestones (every 50 points)

#### 3.5 Validation System
- **Path Checking:**
  - Flood fill algorithm to ensure all spaces reachable
  - Regenerate if validation fails
  - Maximum 10 regeneration attempts before fallback to simple pattern

#### 3.6 Visual Design
- **Obstacle Appearance:**
  - Glowing borders matching game theme
  - Semi-transparent fill (30% opacity)
  - Pulsing animation to distinguish from snake/food
  - Different visual styles per generation pattern

#### 3.7 Mode Integration
- **Procedural Mode Settings:**
  - Pattern selector: Random, Maze, Symmetric, Rooms
  - Density slider: Low, Medium, High
  - Regeneration button: Create new layout without restarting

---

## Phase 4: Level Editor

### Objective
Provide players with tools to design custom obstacle layouts and share them with others.

### Technical Requirements

#### 4.1 Editor Interface
- **UI Components:**
  - Grid view with hover highlighting
  - Tool palette: Place Wall, Erase, Set Snake Start, Set Food Spawn
  - Control buttons: Clear All, Validate, Save, Load, Test Play

#### 4.2 Editing Tools
- **Placement Modes:**
  - Click: Place/remove single obstacle
  - Drag: Draw continuous walls
  - Fill: Flood fill enclosed areas
  - Symmetric: Mirror placements across axis

#### 4.3 Level Data Structure
```javascript
{
  name: "Level Name",
  author: "Player Name",
  gridSize: 20,
  obstacles: [[x1, y1], [x2, y2], ...],
  player1Start: {x: 5, y: 10},
  player2Start: {x: 15, y: 10}, // optional
  foodSpawns: [[x1, y1], [x2, y2], ...], // optional predefined food locations
  difficulty: "medium",
  created: timestamp
}
```

#### 4.4 Validation System
- **Automatic Checks:**
  - Ensure all areas reachable via pathfinding
  - Verify minimum play area (avoid over-crowding)
  - Check snake start positions are valid
  - Confirm at least one valid food spawn location

- **Visual Feedback:**
  - Green checkmark: Level valid
  - Red X with error message: Specific issue highlighted
  - Yellow warning: Suboptimal but playable

#### 4.5 Save/Load System
- **Local Storage:**
  - Save up to 10 custom levels locally
  - Auto-save on every edit (undo history)
  - Level metadata: name, creation date, play count

- **Export/Import:**
  - Generate shareable code (Base64 encoded JSON)
  - Copy to clipboard functionality
  - Import from code input field
  - URL parameter support for instant loading

#### 4.6 Testing Features
- **Test Play:**
  - Instant switch from editor to playable mode
  - Return to editor preserves unsaved changes
  - Quick iteration for level refinement

#### 4.7 Community Features (Optional Enhancement)
- **Level Browser:** Display list of saved/imported levels
- **Rating System:** Star rating for imported levels
- **Leaderboards:** High scores per custom level
- **Tags/Categories:** Difficulty, style, theme tags

#### 4.8 UI/UX Design
- **Editor Screen Layout:**
  ```
  ┌─────────────────────────────────────┐
  │  [Tool Palette]    Level: [Name]    │
  ├─────────────────────────────────────┤
  │                                     │
  │        [Editable Grid Canvas]       │
  │                                     │
  ├─────────────────────────────────────┤
  │ Clear | Validate | Save | Load      │
  │ Test Play | Export | Import         │
  └─────────────────────────────────────┘
  ```

- **Accessibility:**
  - Keyboard shortcuts for all tools
  - Tooltips explaining each function
  - Tutorial overlay for first-time users

---

## Implementation Timeline

### Phase 1: Multiplayer Mode
- **Estimated Time:** 4-6 hours
- **Priority:** High
- **Dependencies:** None

### Phase 2: AI Opponent
- **Estimated Time:** 6-8 hours
- **Priority:** Medium-High
- **Dependencies:** Multiplayer collision system

### Phase 3: Procedural Generation
- **Estimated Time:** 8-10 hours
- **Priority:** Medium
- **Dependencies:** Obstacle rendering system

### Phase 4: Level Editor
- **Estimated Time:** 12-15 hours
- **Priority:** Medium-Low
- **Dependencies:** Procedural generation obstacle system

**Total Estimated Development Time:** 30-39 hours

---

## Technical Considerations

### Performance Optimization
- **Frame Rate Target:** Maintain 60 FPS
- **Pathfinding:** Run AI calculations asynchronously when possible
- **Canvas Rendering:** Use requestAnimationFrame efficiently
- **Memory Management:** Clear unused level data, limit history size

### Code Architecture
- **Modularity:** Separate concerns (rendering, game logic, AI, level management)
- **Reusability:** Create utility functions for common operations
- **Maintainability:** Comment complex algorithms, use descriptive variable names

### Testing Strategy
- **Unit Testing:** Pathfinding, collision detection, level validation
- **Integration Testing:** Mode switching, multiplayer interactions
- **User Testing:** Playability, difficulty balance, UI intuitiveness

### Browser Compatibility
- **Target Browsers:** Chrome, Firefox, Safari, Edge (latest versions)
- **Fallbacks:** Graceful degradation for older browsers
- **Mobile Support:** Touch controls consideration (future enhancement)

---

## Future Enhancements (Post-Phase 4)

1. **Online Multiplayer:** WebSocket-based remote play
2. **Tournament Mode:** Bracket-style competition structure
3. **Replay System:** Record and playback gameplay
4. **Skin Customization:** Upload custom snake sprites
5. **Power-Up System:** Temporary abilities and bonuses
6. **Mobile App:** Native iOS/Android versions
7. **Level Sharing Platform:** Cloud-based level repository
8. **Spectator Mode:** Watch others play in real-time

---

## File Structure (Post-Implementation)

```
neon-snake/
├── index.html
├── css/
│   ├── main.css
│   ├── editor.css
│   └── themes.css
├── js/
│   ├── game.js (core game loop)
│   ├── multiplayer.js
│   ├── ai.js
│   ├── pathfinding.js
│   ├── levelGenerator.js
│   ├── levelEditor.js
│   ├── collision.js
│   ├── audio.js
│   └── utils.js
├── assets/
│   ├── sounds/
│   └── images/
└── levels/
    └── community/ (exported level files)
```

---

## Success Metrics

### Multiplayer Mode
- Two players can play simultaneously without lag
- Collision detection works accurately 99%+ of the time
- Controls are responsive and intuitive

### AI Opponent
- AI makes intelligent decisions 90%+ of the time
- Difficulty levels provide appropriate challenge
- AI doesn't get trapped in loops

### Procedural Generation
- Generated levels are always playable
- Patterns provide visual variety
- Generation time < 100ms

### Level Editor
- Users can create levels in < 5 minutes
- Export/import works reliably
- Validation catches all unplayable levels

---

## Version History

- **v1.0** - Initial game with single player modes
- **v2.0** - Multiplayer mode added (Phase 1)
- **v2.5** - AI opponent implemented (Phase 2)
- **v3.0** - Procedural generation added (Phase 3)
- **v4.0** - Level editor complete (Phase 4)

---

## Contact & Contributions

This specification is a living document and may be updated as development progresses. Feedback and suggestions for improvement are welcome.

**Last Updated:** January 29, 2026
