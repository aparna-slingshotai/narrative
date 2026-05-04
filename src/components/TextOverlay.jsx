import { useControls, folder } from 'leva'
import { useSceneStore } from '../state/sceneStore'
import { path } from '../scene/path'

const wrapperStyle = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '64px 20px 40px',
  zIndex: 2,
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
}

// Constrain content to a phone-sized column on desktop too.
const innerColumnStyle = {
  width: '100%',
  maxWidth: 420,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
}

const headerStyle = {
  fontFamily: 'Georgia, "Times New Roman", "DM Serif Display", serif',
  fontSize: 26,
  fontWeight: 400,
  color: 'white',
  textAlign: 'center',
  lineHeight: 1.1,
  margin: 0,
  textShadow: '0 2px 10px rgba(0,0,0,0.3)',
  letterSpacing: '-0.005em',
  transition: 'opacity 0.4s ease',
}

const ctaGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  pointerEvents: 'auto',
  transition: 'opacity 0.4s ease',
}

const ctaSingleStyle = {
  display: 'flex',
  justifyContent: 'center',
  pointerEvents: 'auto',
  transition: 'opacity 0.4s ease',
}

const solidCardStyle = {
  background: '#f3ede1',
  borderRadius: 14,
  padding: '14px 16px',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 13,
  fontWeight: 600,
  color: '#222',
  lineHeight: 1.3,
  minHeight: 64,
  boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  gap: 8,
}

const frostedCardStyle = {
  background: 'rgba(255, 255, 255, 0.18)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  borderRadius: 18,
  padding: '14px 16px',
  border: '1px solid rgba(255, 255, 255, 0.28)',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 13,
  fontWeight: 600,
  color: 'white',
  textShadow: '0 1px 6px rgba(0,0,0,0.4)',
  lineHeight: 1.3,
  minHeight: 64,
  boxShadow: '0 4px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.35)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  gap: 8,
}

const solidIconStyle = {
  color: '#5a4a30',
  fontSize: 22,
  alignSelf: 'flex-start',
  lineHeight: 1,
}

const frostedIconStyle = {
  color: 'white',
  fontSize: 22,
  alignSelf: 'flex-start',
  lineHeight: 1,
  filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.35))',
}

export default function TextOverlay() {
  // Diagnostic: force solid + showHeader. Reverts once breathing source found.
  const { showHeader } = useControls('Text Style', {
    showHeader: { value: true, label: 'show header' },
    frosted: { value: false, label: 'frosted glass' },
  })
  const frosted = false

  const currentNodeId = useSceneStore((s) => s.currentNodeId)
  const isWalking = useSceneStore((s) => s.isWalking)
  const selectChoice = useSceneStore((s) => s.selectChoice)

  const node = currentNodeId ? path.nodes[currentNodeId] : null
  const headerText = node?.headerText ?? ''
  const choices = node?.choices ?? []

  const cardStyle = frosted ? frostedCardStyle : solidCardStyle
  const iconStyle = frosted ? frostedIconStyle : solidIconStyle

  // Fade overlay out while walking; fade back in on arrival.
  const fadeOpacity = isWalking ? 0 : 1
  const ctasInteractive = !isWalking && choices.length > 0

  return (
    <div style={wrapperStyle}>
      <div style={innerColumnStyle}>
        {showHeader && headerText && (
          <h1 style={{ ...headerStyle, opacity: fadeOpacity }}>
            {headerText.split('\n').map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </h1>
        )}
      </div>
      <div style={{ flex: 1 }} />
      <div style={innerColumnStyle}>
        {choices.length > 0 && (
          <div
            style={{
              ...(choices.length === 1 ? ctaSingleStyle : ctaGridStyle),
              opacity: fadeOpacity,
              pointerEvents: ctasInteractive ? 'auto' : 'none',
            }}
          >
            {choices.map((cta, i) => (
              <button
                key={i}
                style={cardStyle}
                onClick={() => selectChoice(cta.nextId, cta.duration)}
              >
                {cta.icon && (
                  <span className="material-symbols-rounded" style={iconStyle}>
                    {cta.icon}
                  </span>
                )}
                <span>{cta.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
