export default function WorkspaceMetric({ label, value, detail, tone = 'green' }) {
  return (
    <article className={`workspace-metric workspace-metric--${tone}`}>
      <span className="workspace-metric-mark" aria-hidden="true" />
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </article>
  )
}
