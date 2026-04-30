import { create } from 'zustand'

// Single source of truth for the path-walking state machine.
// Both the in-canvas PathWalker and the HTML TextOverlay subscribe here.
export const useSceneStore = create((set, get) => ({
  currentNodeId: null,        // null until path.js boots us with start node
  fromNodeId: null,
  isWalking: false,
  walkStartTime: 0,            // seconds (THREE clock)
  walkDuration: 4,

  // Per-waypoint runtime overrides edited via leva. Shape:
  //   { [nodeId]: { position?: [x,y,z], lookAt?: [x,y,z] } }
  overrides: {},

  // mirrored from leva so PathWalker can defer to OrbitControls when on
  orbitMode: false,
  setOrbitMode: (v) => set({ orbitMode: v }),

  // global walk-speed multiplier (lower = slower; 1 = use durations as-is)
  walkSpeed: 1,
  setWalkSpeed: (v) => set({ walkSpeed: v }),

  // ---- actions ----

  bootstrap: (startId) => {
    if (get().currentNodeId == null) set({ currentNodeId: startId })
  },

  // CTA click: begin a walk to nextId. Wall-clock seconds (perf.now/1000)
  // is captured here so PathWalker can use the same reference.
  selectChoice: (nextId, durationSec) => {
    const fromId = get().currentNodeId
    if (!fromId || fromId === nextId) return
    set({
      fromNodeId: fromId,
      currentNodeId: nextId,
      isWalking: true,
      walkStartTime: performance.now() / 1000,
      walkDuration: durationSec ?? 4,
    })
  },

  arrive: () => set({ isWalking: false, fromNodeId: null }),

  setOverride: (nodeId, patch) =>
    set((s) => ({
      overrides: { ...s.overrides, [nodeId]: { ...(s.overrides[nodeId] || {}), ...patch } },
    })),
}))
