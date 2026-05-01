import { useEffect, useRef } from 'react'
import { useControls, folder } from 'leva'

// Procedural meadow / breeze ambience using Web Audio API.
// No audio files needed — all generated from filtered brown noise.
//
// Browsers block AudioContext until a user gesture, so the graph is
// built on the first pointer/touch/key event and faded in.
export default function AmbientAudio() {
  const ctrl = useControls('Ambient Audio', {
    enabled: { value: false, label: 'enabled' },
    volume: { value: 0.40, min: 0, max: 1, step: 0.01 },
    breeze: folder({
      windAmount: { value: 0.70, min: 0, max: 1, step: 0.01, label: 'wind' },
      gustSpeed: { value: 0.18, min: 0.02, max: 1, step: 0.01, label: 'gust speed' },
      brightness: { value: 480, min: 100, max: 2000, step: 10, label: 'brightness (Hz)' },
    }),
    bassAmount: { value: 0.25, min: 0, max: 1, step: 0.01, label: 'low hum' },
  })

  const audioRef = useRef(null)

  // Build the audio graph on first user gesture
  useEffect(() => {
    const start = () => {
      if (audioRef.current) return
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()

      // brown noise buffer (2s loop)
      const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
      const data = noiseBuffer.getChannelData(0)
      let last = 0
      for (let i = 0; i < data.length; i++) {
        const w = Math.random() * 2 - 1
        last = (last + 0.02 * w) / 1.02
        data[i] = last * 3.5
      }

      // WIND: noise → lowpass (LFO-modulated cutoff) → static gain → master
      const windSrc = ctx.createBufferSource()
      windSrc.buffer = noiseBuffer
      windSrc.loop = true

      const windLpf = ctx.createBiquadFilter()
      windLpf.type = 'lowpass'
      windLpf.frequency.value = 480
      windLpf.Q.value = 0.6

      const windLevel = ctx.createGain()
      windLevel.gain.value = 0.7

      // gust LFO modulates filter cutoff
      const gustLfo = ctx.createOscillator()
      gustLfo.frequency.value = 0.18
      const gustGain = ctx.createGain()
      gustGain.gain.value = 220
      gustLfo.connect(gustGain).connect(windLpf.frequency)

      windSrc.connect(windLpf).connect(windLevel)

      // BASS: noise → very low lowpass → static gain → master
      const bassSrc = ctx.createBufferSource()
      bassSrc.buffer = noiseBuffer
      bassSrc.loop = true
      const bassLpf = ctx.createBiquadFilter()
      bassLpf.type = 'lowpass'
      bassLpf.frequency.value = 90
      bassLpf.Q.value = 1.2
      const bassLevel = ctx.createGain()
      bassLevel.gain.value = 0.25
      bassSrc.connect(bassLpf).connect(bassLevel)

      // Master
      const master = ctx.createGain()
      master.gain.value = 0
      windLevel.connect(master)
      bassLevel.connect(master)
      master.connect(ctx.destination)

      windSrc.start()
      bassSrc.start()
      gustLfo.start()

      audioRef.current = { ctx, master, windLevel, bassLevel, windLpf, gustLfo }
      apply(audioRef.current, ctrl)

      window.removeEventListener('pointerdown', start)
      window.removeEventListener('keydown', start)
      window.removeEventListener('touchstart', start)
    }

    window.addEventListener('pointerdown', start, { passive: true })
    window.addEventListener('keydown', start)
    window.addEventListener('touchstart', start, { passive: true })

    return () => {
      window.removeEventListener('pointerdown', start)
      window.removeEventListener('keydown', start)
      window.removeEventListener('touchstart', start)
      const a = audioRef.current
      if (a) {
        try { a.ctx.close() } catch {}
        audioRef.current = null
      }
    }
  }, [])

  // Apply control changes to the live graph
  useEffect(() => {
    if (!audioRef.current) return
    apply(audioRef.current, ctrl)
  }, [ctrl.enabled, ctrl.volume, ctrl.windAmount, ctrl.gustSpeed, ctrl.brightness, ctrl.bassAmount])

  return null
}

function ramp(param, v, ctx, secs = 0.4) {
  param.cancelScheduledValues(ctx.currentTime)
  param.setValueAtTime(param.value, ctx.currentTime)
  param.linearRampToValueAtTime(v, ctx.currentTime + secs)
}

function apply(audio, ctrl) {
  const { ctx, master, windLevel, bassLevel, windLpf, gustLfo } = audio
  ramp(master.gain, ctrl.enabled ? ctrl.volume : 0, ctx, 0.6)
  ramp(windLevel.gain, ctrl.windAmount, ctx)
  ramp(bassLevel.gain, ctrl.bassAmount, ctx)
  ramp(windLpf.frequency, ctrl.brightness, ctx)
  ramp(gustLfo.frequency, ctrl.gustSpeed, ctx)
}
