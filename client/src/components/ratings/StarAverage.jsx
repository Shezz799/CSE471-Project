const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * Partial gold stars from an average 0–5 (no numeric label — use on offers list).
 */
const StarAverage = ({ average, className = "", size = "sm" }) => {
  const v = typeof average === "number" && !Number.isNaN(average) ? clamp(average, 0, 5) : 0;
  const pct = (v / 5) * 100;
  const label = `${v.toFixed(1)} out of 5 stars average`;
  return (
    <span
      className={`star-average star-average--${size} ${className}`.trim()}
      title={label}
      role="img"
      aria-label={label}
    >
      <span className="star-average__bg" aria-hidden="true">
        ★★★★★
      </span>
      <span className="star-average__fg" style={{ width: `${pct}%` }} aria-hidden="true">
        ★★★★★
      </span>
    </span>
  );
};

export default StarAverage;
