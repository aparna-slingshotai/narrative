import { useEffect, useState, useRef } from 'react'
import { useSceneStore } from '../state/sceneStore'

// Bee SVG — small, body + wings as separate ovals so wings can animate
// independently of the body bobbing.
function BeeSvg() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
      {/* wings */}
      <ellipse cx="11" cy="6" rx="6" ry="3.4" fill="rgba(255,255,255,0.55)" />
      <ellipse cx="17" cy="6" rx="6" ry="3.4" fill="rgba(255,255,255,0.55)" />
      {/* body */}
      <ellipse cx="14" cy="11" rx="6.2" ry="3.6" fill="#e7b73a" />
      {/* stripes */}
      <rect x="11.5" y="7.8" width="1.4" height="6.4" fill="#2b210d" rx="0.4" />
      <rect x="14.6" y="7.8" width="1.4" height="6.4" fill="#2b210d" rx="0.4" />
      {/* head */}
      <circle cx="20.1" cy="11" r="2.2" fill="#2b210d" />
    </svg>
  )
}

const wrapStyle = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  overflow: 'hidden',
  zIndex: 3,
}

export default function Bees() {
  const isWalking = useSceneStore((s) => s.isWalking)
  const currentNodeId = useSceneStore((s) => s.currentNodeId)

  // 'idle' = no bee mounted; 'enter' = flying in; 'hover' = waiting near
  // the user; 'exit' = flying off after answer.
  const [phase, setPhase] = useState('idle')
  const exitTimeout = useRef(null)
  const enterTimeout = useRef(null)

  // When user lands on a node (and it's not the final restart node), spawn
  // a bee after a short beat. Cancelling pending timeouts means quickly
  // toggling nodes never leaves a stale bee on screen.
  useEffect(() => {
    clearTimeout(enterTimeout.current)
    clearTimeout(exitTimeout.current)
    if (isWalking) {
      // walking away: trigger exit if we were hovering
      setPhase((p) => (p === 'hover' || p === 'enter' ? 'exit' : 'idle'))
      exitTimeout.current = setTimeout(() => setPhase('idle'), 1100)
      return
    }
    if (!currentNodeId) return
    // arrived: schedule entry
    setPhase('idle')
    enterTimeout.current = setTimeout(() => setPhase('enter'), 400)
    const hoverTimeout = setTimeout(() => setPhase('hover'), 400 + 1500)
    return () => {
      clearTimeout(hoverTimeout)
    }
  }, [isWalking, currentNodeId])

  if (phase === 'idle') return null

  return (
    <>
      <style>{`
        @keyframes narrative-bee-enter {
          0%   { transform: translate(-20vw, 30vh) rotate(-6deg); opacity: 0; }
          25%  { opacity: 1; }
          60%  { transform: translate(40vw, 38vh) rotate(8deg); }
          100% { transform: translate(50vw, 50vh) rotate(0deg); opacity: 1; }
        }
        @keyframes narrative-bee-hover {
          0%, 100% { transform: translate(50vw, 50vh) rotate(-3deg); }
          25%      { transform: translate(52vw, 49vh) rotate(2deg); }
          50%      { transform: translate(49vw, 51vh) rotate(-2deg); }
          75%      { transform: translate(51vw, 50vh) rotate(3deg); }
        }
        @keyframes narrative-bee-exit {
          0%   { transform: translate(50vw, 50vh) rotate(0deg); opacity: 1; }
          40%  { transform: translate(80vw, 42vh) rotate(8deg); }
          100% { transform: translate(120vw, 35vh) rotate(0deg); opacity: 0; }
        }
        @keyframes narrative-bee-wings {
          0%, 100% { transform: scaleY(1); }
          50%      { transform: scaleY(0.4); }
        }
      `}</style>
      <div style={wrapStyle} aria-hidden="true">
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            // The hover position is anchored at the choice grid horizontal
            // center on a phone-width column. Translate the wrapper so the
            // animations' translate() values land mid-screen.
            marginLeft: -14,
            marginTop: -10,
            animation:
              phase === 'enter'
                ? 'narrative-bee-enter 1.5s cubic-bezier(.4,.1,.3,1) forwards'
                : phase === 'hover'
                ? 'narrative-bee-hover 2.4s ease-in-out infinite'
                : 'narrative-bee-exit 1.0s cubic-bezier(.5,.0,.7,1) forwards',
            willChange: 'transform, opacity',
          }}
        >
          <div
            style={{
              animation: 'narrative-bee-wings 0.09s linear infinite',
              transformOrigin: 'center',
            }}
          >
            <BeeSvg />
          </div>
        </div>
      </div>
    </>
  )
}
