import { useControls, folder } from 'leva'

const wrapperStyle = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  padding: '64px 20px 40px',
  zIndex: 2,
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
}

const headerStyle = {
  fontFamily: '"DM Serif Display", Georgia, "Times New Roman", serif',
  fontSize: 36,
  fontWeight: 400,
  color: 'white',
  textAlign: 'center',
  lineHeight: 1.05,
  margin: 0,
  textShadow: '0 2px 12px rgba(0,0,0,0.35)',
  letterSpacing: '-0.01em',
}

const ctaGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  pointerEvents: 'auto',
}

const ctaSingleStyle = {
  display: 'flex',
  justifyContent: 'center',
  pointerEvents: 'auto',
}

const cardBaseStyle = {
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

const iconCircle = {
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: '#e8e0d0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  alignSelf: 'flex-start',
}

export default function TextOverlay() {
  const ctrl = useControls('Text Input', {
    showHeader: { value: true, label: 'show header' },
    headerText: {
      value: 'How are you\nfeeling right now?',
      label: 'header',
      rows: 2,
    },
    ctas: folder({
      ctaCount: { value: 4, min: 0, max: 4, step: 1, label: 'count' },
      cta1: { value: '🧠  My thoughts are tangled', label: 'cta 1' },
      cta2: { value: '💛  I want to understand myself better', label: 'cta 2' },
      cta3: { value: '✨  I have something on my mind', label: 'cta 3' },
      cta4: { value: '🧭  Just curious', label: 'cta 4' },
    }),
  })

  const ctas = [ctrl.cta1, ctrl.cta2, ctrl.cta3, ctrl.cta4].slice(0, ctrl.ctaCount)

  // split icon (first emoji + spaces) from text
  function splitIcon(s) {
    const match = s.match(/^(\S+)\s+(.*)$/)
    if (match && /\p{Extended_Pictographic}/u.test(match[1])) {
      return [match[1], match[2]]
    }
    return [null, s]
  }

  return (
    <div style={wrapperStyle}>
      {ctrl.showHeader && (
        <h1 style={headerStyle}>
          {ctrl.headerText.split('\n').map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </h1>
      )}
      <div style={{ flex: 1 }} />
      {ctas.length > 0 && (
        <div style={ctas.length === 1 ? ctaSingleStyle : ctaGridStyle}>
          {ctas.map((text, i) => {
            const [icon, label] = splitIcon(text)
            return (
              <button
                key={i}
                style={cardBaseStyle}
                onClick={() => console.log('CTA tapped:', label)}
              >
                {icon && <span style={iconCircle}>{icon}</span>}
                <span>{label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
