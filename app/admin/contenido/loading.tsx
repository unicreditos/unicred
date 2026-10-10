export default function Loading() {
  return (
    <div className="uc-card uc-pad" role="status" aria-label="Cargando" style={{ display: 'grid', gap: 12 }}>
      <div className="uc-cfg-skel" style={{ width: '40%' }} />
      <div className="uc-cfg-skel" style={{ width: '90%' }} />
      <div className="uc-cfg-skel" style={{ width: '75%' }} />
    </div>
  )
}
