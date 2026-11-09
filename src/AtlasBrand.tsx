export function AtlasBrand() {
  return (
    <a
      href={import.meta.env.BASE_URL || '/'}
      className="atlas-brand"
      aria-label="Game Traveler home"
      title="Return to the map home"
    >
      {/* Kartbrettet tegnes inline i blekk- og vermilionfargen, så det følger mørk modus */}
      <svg className="atlas-mark" viewBox="0 0 120 96" width="120" height="96" aria-hidden="true">
        <g style={{ fill: 'var(--color-ink)' }}>
          <polygon points="0,16 24,24 24,96 0,88" />
          <polygon points="28,24 58,0 58,72 28,96" />
          <polygon points="62,0 92,24 92,96 62,72" />
        </g>
        <polygon points="96,24 120,16 120,88 96,96" style={{ fill: 'var(--color-magenta)' }} />
      </svg>
      <h1>Game<span>Traveler</span></h1>
    </a>
  );
}
