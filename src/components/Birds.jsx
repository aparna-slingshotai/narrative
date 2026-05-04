// Stylized bird silhouettes drifting across the sky. Pure DOM/SVG so they
// bypass the watercolor compositor — keeps silhouette edges stable and
// avoids the wet-edge warping the in-shader sway used to introduce.

const BIRD_PATH = 'M0 6 Q5 0 10 6 Q15 0 20 6'

const birds = [
  { delay: '0s',   duration: '22s', y: '14%', scale: 0.9 },
  { delay: '8s',   duration: '26s', y: '9%',  scale: 0.7 },
  { delay: '15s',  duration: '20s', y: '19%', scale: 1.0 },
]

const wrapStyle = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  overflow: 'hidden',
  zIndex: 1,
}

export default function Birds() {
  return (
    <>
      <style>{`
        @keyframes narrative-bird-drift {
          0%   { transform: translateX(-12vw) translateY(0px); opacity: 0; }
          8%   { opacity: 0.55; }
          50%  { transform: translateX(50vw) translateY(-14px); }
          92%  { opacity: 0.55; }
          100% { transform: translateX(112vw) translateY(0px); opacity: 0; }
        }
        @keyframes narrative-bird-flap {
          0%, 100% { transform: scaleY(1); }
          50%      { transform: scaleY(0.45); }
        }
      `}</style>
      <div style={wrapStyle} aria-hidden="true">
        {birds.map((b, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: b.y,
              left: 0,
              width: 24,
              height: 12,
              animation: `narrative-bird-drift ${b.duration} linear ${b.delay} infinite`,
              transform: 'translateX(-12vw)',
              willChange: 'transform, opacity',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                animation: `narrative-bird-flap 0.45s ease-in-out infinite`,
                transform: `scale(${b.scale})`,
                transformOrigin: 'center',
              }}
            >
              <svg width="24" height="12" viewBox="0 0 20 12" fill="none">
                <path
                  d={BIRD_PATH}
                  stroke="#3a4a3a"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.55"
                />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
