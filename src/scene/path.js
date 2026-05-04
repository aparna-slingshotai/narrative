// Narrative path graph. Each node is a "story stop" — the camera rests
// at `position` looking at `lookAt`, displays `headerText` plus a list
// of `choices`. Tapping a choice walks the camera to `choices[i].nextId`.
//
// To add a new stop:
//   1. Add a node entry below with a unique key.
//   2. Reference its key from another node's `choices[].nextId`.
//   3. Tune position/lookAt by toggling `Camera → orbit (drag)`,
//      framing the shot, then hitting `Path → log camera` to print
//      JSON for paste.
//
// Terminal node = empty `choices` array.

export const path = {
  start: 'arrival',
  nodes: {
    // 1. Arrival — open meadow, hero pine front and center, river to the right
    arrival: {
      position: [0, 1.7, 5.5],
      lookAt:   [0, 2.3, -3],
      headerText: 'How are you\nfeeling right now?',
      choices: [
        { icon: 'psychology',   text: 'My thoughts are tangled',     nextId: 'riverbank', duration: 5 },
        { icon: 'favorite',     text: 'I want to understand myself', nextId: 'riverbank', duration: 5 },
        { icon: 'auto_awesome', text: 'I have something on my mind', nextId: 'riverbank', duration: 5 },
        { icon: 'explore',      text: 'Just curious',                nextId: 'riverbank', duration: 5 },
      ],
    },

    // 2. Riverbank — by the water, looking downstream toward the bend
    riverbank: {
      position: [-1.6, 1.6, 2.6],
      lookAt:   [3, 1.4, -3],
      headerText: 'Take a moment.\nWhat do you notice?',
      choices: [
        { icon: 'air',         text: 'The breeze',          nextId: 'grove',     duration: 5 },
        { icon: 'water_drop',  text: 'The water moving',    nextId: 'grove',     duration: 5 },
        { icon: 'volume_up',   text: 'How quiet it is',     nextId: 'grove',     duration: 5 },
      ],
    },

    // 3. Grove — among the trees, looking up at the canopy
    grove: {
      position: [-2.4, 1.7, -1],
      lookAt:   [0, 3.5, -8],
      headerText: 'What\'s been weighing\non you lately?',
      choices: [
        { icon: 'work',          text: 'Work',           nextId: 'crossing',  duration: 5 },
        { icon: 'group',         text: 'A relationship', nextId: 'crossing',  duration: 5 },
        { icon: 'self_improvement', text: 'My own thoughts', nextId: 'crossing', duration: 5 },
        { icon: 'pending',       text: 'Hard to name',   nextId: 'crossing',  duration: 5 },
      ],
    },

    // 4. Crossing — middle of the meadow, by the bend in the river
    crossing: {
      position: [1.5, 1.6, -2.5],
      lookAt:   [3.5, 1.5, -7],
      headerText: 'Is there something\nyou\'d like to set down?',
      choices: [
        { icon: 'check_circle', text: 'Yes',              nextId: 'release',   duration: 5 },
        { icon: 'help',         text: 'I\'m not sure',    nextId: 'release',   duration: 5 },
        { icon: 'block',        text: 'Not yet',          nextId: 'release',   duration: 5 },
      ],
    },

    // 5. Release — looking out across the river, distant trees
    release: {
      position: [3.2, 1.7, -4],
      lookAt:   [-2, 2.0, -8],
      headerText: 'Let it rest here\nfor a while.',
      choices: [
        { icon: 'spa',         text: 'I\'m ready',       nextId: 'horizon',   duration: 5 },
        { icon: 'schedule',    text: 'Give me a moment', nextId: 'horizon',   duration: 7 },
      ],
    },

    // 6. Horizon — final view, low over the river looking downstream.
    // idlePan slowly sweeps the lookAt yaw so the camera glides along
    // the river's bend after arrival.
    horizon: {
      position: [-2.0, 1.3, 1.5],
      lookAt:   [3.5, 1.0, -8],
      idlePan: { axis: 'y', amplitudeRad: 0.22, periodSec: 16 },
      headerText: 'Carry only what\nfeels light.',
      choices: [
        { icon: 'restart_alt', text: 'Begin again', nextId: 'arrival', duration: 6 },
      ],
    },
  },
}

export const allNodeIds = Object.keys(path.nodes)
