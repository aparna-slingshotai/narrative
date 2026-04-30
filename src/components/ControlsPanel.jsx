import { useState } from 'react'

const panelStyle = {
  position: 'absolute',
  top: 12,
  right: 12,
  zIndex: 10,
  background: 'rgba(20, 24, 30, 0.78)',
  color: '#e8eef5',
  padding: '10px 12px',
  borderRadius: 10,
  fontFamily: '-apple-system, system-ui, sans-serif',
  fontSize: 12,
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
  userSelect: 'none',
  pointerEvents: 'auto',
  width: 180,
}

const collapsedStyle = { ...panelStyle, width: 'auto', padding: '6px 10px' }

const rowStyle = { display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }
const labelStyle = { display: 'flex', justifyContent: 'space-between', opacity: 0.85 }
const sliderStyle = { width: '100%', accentColor: '#7eb8ff' }
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 }
const buttonStyle = {
  background: 'transparent', border: 'none', color: '#e8eef5', cursor: 'pointer',
  fontSize: 14, padding: 0, lineHeight: 1,
}

function Slider({ label, value, min, max, step, onChange }) {
  return (
    <div style={rowStyle}>
      <div style={labelStyle}>
        <span>{label}</span>
        <span style={{ opacity: 0.6 }}>{value.toFixed(2)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={sliderStyle}
      />
    </div>
  )
}

export default function ControlsPanel({ controls, onChange }) {
  const [open, setOpen] = useState(true)

  if (!open) {
    return (
      <div style={collapsedStyle}>
        <button style={buttonStyle} onClick={() => setOpen(true)}>⚙︎</button>
      </div>
    )
  }

  const set = (key) => (v) => onChange({ ...controls, [key]: v })

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span>Controls</span>
        <button style={buttonStyle} onClick={() => setOpen(false)}>—</button>
      </div>
      <Slider label="Touch radius" value={controls.touchRadius} min={0.5} max={5} step={0.1} onChange={set('touchRadius')} />
      <Slider label="Touch strength" value={controls.touchStrength} min={0} max={3} step={0.05} onChange={set('touchStrength')} />
      <Slider label="Wind strength" value={controls.windStrength} min={0} max={3} step={0.05} onChange={set('windStrength')} />
      <Slider label="Wind speed" value={controls.windSpeed} min={0} max={4} step={0.05} onChange={set('windSpeed')} />
    </div>
  )
}
