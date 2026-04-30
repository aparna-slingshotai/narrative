// Narrative path graph. Each node is a "story stop" — the camera rests
// at `position` looking at `lookAt`, displays `headerText` plus a list
// of `choices`. Tapping a choice walks the camera to `choices[i].nextId`.
//
// To add a new stop:
//   1. Add a node entry below with a unique key.
//   2. Reference its key from another node's `choices[].nextId`.
//   3. (optional) Tune the position/lookAt by toggling
//      `Camera → orbit (drag)` in the panel, framing the shot, then
//      reading the values from the `Path` folder's `copy values` button.
//
// Terminal node = empty `choices` array.

export const path = {
  start: 'origin',
  nodes: {
    origin: {
      position: [0, 1.7, 5],
      lookAt:   [0, 2.4, -3],
      headerText: 'How are you\nfeeling right now?',
      choices: [
        { icon: 'psychology',   text: 'My thoughts are tangled',     nextId: 'destination', duration: 4 },
        { icon: 'favorite',     text: 'I want to understand myself', nextId: 'destination', duration: 4 },
        { icon: 'auto_awesome', text: 'I have something on my mind', nextId: 'destination', duration: 4 },
        { icon: 'explore',      text: 'Just curious',                nextId: 'destination', duration: 4 },
      ],
    },
    destination: {
      position: [-2.2, 1.7, 1.5],
      lookAt:   [0, 2.0, -3],
      headerText: 'Take a moment.\nNotice the breeze.',
      choices: [
        { icon: 'arrow_back',  text: 'Go back',  nextId: 'origin', duration: 4 },
      ],
    },
  },
}

export const allNodeIds = Object.keys(path.nodes)
