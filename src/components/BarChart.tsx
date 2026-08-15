export function BarChart({ data, prefix }: { data: { label: string; value: number }[]; prefix?: string }) {
  if (!data.length || data.every((d) => d.value === 0)) {
    return <p className="py-8 text-center text-sm text-ink-muted">Not enough data yet.</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 0.0001);
  const w = 100;
  const h = 40;
  const gap = data.length > 1 ? Math.min(1.5, w / data.length / 4) : 0;
  const barW = (w - gap * (data.length - 1)) / data.length;
  const labelStep = Math.max(1, Math.ceil(data.length / 10));
  const maxIndex = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height: 140 }}>
        <line x1="0" y1={h - 0.3} x2={w} y2={h - 0.3} stroke="#3a2830" strokeWidth="0.3" />
        {data.map((d, i) => {
          const barH = (d.value / max) * (h - 4);
          const x = i * (barW + gap);
          const y = h - barH;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={Math.min(0.8, barW / 3)}
              fill={i === maxIndex ? "#f3afc4" : "#e48ca9"}
              opacity={i === maxIndex ? 1 : 0.55}
            >
              <title>
                {d.label}: {prefix}
                {d.value.toFixed(2)}
              </title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex text-[9px] text-ink-muted">
        {data.map((d, i) => (
          <span key={i} style={{ width: `${100 / data.length}%` }} className="truncate text-center">
            {i % labelStep === 0 ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
