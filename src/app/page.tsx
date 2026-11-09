export default function Home() {
  return (
    <main className="setup-page">
      <section className="setup-card" aria-labelledby="setup-title">
        <span className="eyebrow">PRINCES · FASE 0</span>
        <h1 id="setup-title">Fondasi aplikasi siap dikembangkan</h1>
        <p>
          Kerangka website dan sistem desain mobile telah disiapkan. Login,
          absensi, dan dashboard belum tersedia pada fase ini.
        </p>
        <div className="setup-status" role="status">
          <span className="status-dot" aria-hidden="true" />
          Database development belum dihubungkan
        </div>
      </section>
    </main>
  );
}
