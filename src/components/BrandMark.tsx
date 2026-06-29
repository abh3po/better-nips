/**
 * Wordmark glyph: a small web-of-trust — nodes vouching for a center. Uses
 * `currentColor` so it inherits the brand accent and adapts if restyled.
 */
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="1.5" opacity="0.55">
        <line x1="16" y1="16" x2="16" y2="5" />
        <line x1="16" y1="16" x2="26" y2="11" />
        <line x1="16" y1="16" x2="25" y2="23" />
        <line x1="16" y1="16" x2="7" y2="23" />
        <line x1="16" y1="16" x2="6" y2="11" />
      </g>
      <g fill="currentColor">
        <circle cx="16" cy="5" r="2.4" />
        <circle cx="26" cy="11" r="2.4" />
        <circle cx="25" cy="23" r="2.4" />
        <circle cx="7" cy="23" r="2.4" />
        <circle cx="6" cy="11" r="2.4" />
      </g>
      <circle cx="16" cy="16" r="4.2" fill="currentColor" />
    </svg>
  );
}
