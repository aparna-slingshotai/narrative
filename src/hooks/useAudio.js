import { useRef, useCallback, useEffect } from 'react'

export function useAudio(url, { loop = false, volume = 1 } = {}) {
  const audioRef = useRef(null)
  const ctxRef = useRef(null)
  const gainRef = useRef(null)

  const init = useCallback(() => {
    if (ctxRef.current) return
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const gain = ctx.createGain()
    gain.gain.value = volume
    gain.connect(ctx.destination)
    ctxRef.current = ctx
    gainRef.current = gain
  }, [volume])

  const play = useCallback(async () => {
    init()
    const ctx = ctxRef.current
    if (ctx.state === 'suspended') await ctx.resume()

    if (audioRef.current) {
      audioRef.current.stop()
    }

    const res = await fetch(url)
    const buf = await res.arrayBuffer()
    const decoded = await ctx.decodeAudioData(buf)
    const source = ctx.createBufferSource()
    source.buffer = decoded
    source.loop = loop
    source.connect(gainRef.current)
    source.start()
    audioRef.current = source
  }, [url, loop, init])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.stop()
      audioRef.current = null
    }
  }, [])

  const setVolume = useCallback((v) => {
    if (gainRef.current) gainRef.current.gain.value = v
  }, [])

  useEffect(() => {
    return () => {
      stop()
      if (ctxRef.current) ctxRef.current.close()
    }
  }, [stop])

  return { play, stop, setVolume }
}

export function useTouchAudio(url, opts) {
  const audio = useAudio(url, opts)
  const started = useRef(false)

  const trigger = useCallback(() => {
    if (!started.current) {
      audio.play()
      started.current = true
    }
  }, [audio])

  return { ...audio, trigger }
}
