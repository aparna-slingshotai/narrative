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
  fontFamily: 'Georgia, "Times New Roman", "DM Serif Display", serif',
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

// Solid (default) card style — matches the original cream Lusion-style cards
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

// Frosted (iOS 26 "liquid glass") variant
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
  boxShadow:
    '0 4px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.35)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  gap: 8,
}

const solidIconCircle = {
  width: 24,
  height: 24,
  borderRadius: '50%',
  background: '#e8e0d0',
  color: '#5a4a30',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 16,
  alignSelf: 'flex-start',
}

const frostedIconCircle = {
  width: 26,
  height: 26,
  borderRadius: '50%',
  background: 'rgba(255, 255, 255, 0.22)',
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 17,
  alignSelf: 'flex-start',
  border: '1px solid rgba(255, 255, 255, 0.25)',
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
      frosted: { value: false, label: 'frosted glass' },
      cta1Icon: { value: 'psychology', label: 'cta 1 icon' },
      cta1Text: { value: 'My thoughts are tangled', label: 'cta 1 text' },
      cta2Icon: { value: 'favorite', label: 'cta 2 icon' },
      cta2Text: { value: 'I want to understand myself better', label: 'cta 2 text' },
      cta3Icon: { value: 'auto_awesome', label: 'cta 3 icon' },
      cta3Text: { value: 'I have something on my mind', label: 'cta 3 text' },
      cta4Icon: { value: 'explore', label: 'cta 4 icon' },
      cta4Text: { value: 'Just curious', label: 'cta 4 text' },
    }),
  })

  const ctas = [
    { icon: ctrl.cta1Icon, text: ctrl.cta1Text },
    { icon: ctrl.cta2Icon, text: ctrl.cta2Text },
    { icon: ctrl.cta3Icon, text: ctrl.cta3Text },
    { icon: ctrl.cta4Icon, text: ctrl.cta4Text },
  ].slice(0, ctrl.ctaCount)

  const cardStyle = ctrl.frosted ? frostedCardStyle : solidCardStyle
  const iconStyle = ctrl.frosted ? frostedIconCircle : solidIconCircle

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
          {ctas.map((cta, i) => (
            <button
              key={i}
              style={cardStyle}
              onClick={() => console.log('CTA tapped:', cta.text)}
            >
              {cta.icon && (
                <span style={iconStyle}>
                  <span className="material-symbols-rounded">{cta.icon}</span>
                </span>
              )}
              <span>{cta.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
