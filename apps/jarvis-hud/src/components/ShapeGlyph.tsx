import type { CoreShapeId } from '../types';

/** Tiny 24×24 line icon per core shape, used in the selector buttons. */
export function ShapeGlyph({ id }: { id: CoreShapeId }) {
  const common = {
    className: 'jv-shape-btn__glyph',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    'aria-hidden': true,
  } as const;

  switch (id) {
    case 'orb':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="9.5" cy="9.5" r="2.2" strokeOpacity="0.5" />
        </svg>
      );
    case 'ring':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" strokeDasharray="14 6" />
          <circle cx="12" cy="12" r="5.5" strokeDasharray="6 4" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'hexagon':
      return (
        <svg {...common}>
          <polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" />
          <polygon points="12,8 16,10.2 16,13.8 12,16 8,13.8 8,10.2" strokeOpacity="0.5" />
        </svg>
      );
    case 'hologram':
      return (
        <svg {...common}>
          <path d="M7 5h10l-1.5 12H8.5z" />
          <path d="M6 20h12" strokeOpacity="0.6" />
          <path d="M8 9h8M8 12h8" strokeOpacity="0.35" />
        </svg>
      );
    case 'reactor':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" strokeDasharray="4 3" />
          <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'wave':
      return (
        <svg {...common}>
          <path d="M2 12c2.5 0 2.5-6 5-6s2.5 12 5 12 2.5-6 5-6 2.5 3 5 3" strokeLinecap="round" />
        </svg>
      );
    case 'minimal':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="6" />
        </svg>
      );
    case 'custom':
    default:
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3 3" />
          <path d="M12 9v6M9 12h6" strokeLinecap="round" />
        </svg>
      );
  }
}
