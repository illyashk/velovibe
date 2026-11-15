import React, { useState, useRef, useCallback } from 'react';
import { Spot, ElevationPoint } from '../types/velovibe';
import { Mountain, TrendingDown } from 'lucide-react';

interface ElevationChartProps {
  spot: Spot;
}

export const ElevationChart: React.FC<ElevationChartProps> = ({ spot }) => {
  const points = spot.elevationProfile;
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<ElevationPoint | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!points || points.length < 2) return null;

  const minElev = Math.min(...points.map((p) => p.elevationM));
  const maxElev = Math.max(...points.map((p) => p.elevationM));
  const maxDist = Math.max(...points.map((p) => p.distanceKm));
  const elevRange = maxElev - minElev || 1;

  const W = 600;
  const H = 160;
  const PAD_X = 44;
  const PAD_Y = 28;

  const toX = (d: number) => PAD_X + (d / (maxDist || 1)) * (W - PAD_X * 2);
  const toY = (e: number) => H - PAD_Y - ((e - minElev) / elevRange) * (H - PAD_Y * 2);

  const linePts = points.map((p) => `${toX(p.distanceKm)},${toY(p.elevationM)}`).join(' ');
  const areaPts = `${toX(points[0].distanceKm)},${H - PAD_Y} ${linePts} ${toX(points[points.length - 1].distanceKm)},${H - PAD_Y}`;

  // Interpolate hover value along the polyline
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * W;
      if (svgX < PAD_X || svgX > W - PAD_X) { setHoverX(null); setHoveredPoint(null); return; }

      setHoverX(svgX);
      const distVal = ((svgX - PAD_X) / (W - PAD_X * 2)) * maxDist;
      // Find nearest point
      let nearest = points[0];
      let minD = Infinity;
      for (const pt of points) {
        const d = Math.abs(pt.distanceKm - distVal);
        if (d < minD) { minD = d; nearest = pt; }
      }
      setHoveredPoint(nearest);
    },
    [points, maxDist]
  );

  const handleMouseLeave = () => { setHoverX(null); setHoveredPoint(null); };

  return (
    <div className="p-4 bg-[#111118] border border-white/[0.06] mt-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-white/[0.04] gap-2">
        <div className="flex items-center gap-2">
          <Mountain className="w-4 h-4 text-[#FFC400]" />
          <h4 className="font-title text-base font-bold text-white uppercase tracking-wider">
            Висотний профіль // {spot.name}
          </h4>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono font-bold">
          <span className="text-[#9aa3b8]">
            Старт: <span className="text-white">{spot.startElevationM} м</span>
          </span>
          <span className="text-[#9aa3b8]">
            Фініш: <span className="text-white">{spot.finishElevationM} м</span>
          </span>
          <span className="flex items-center gap-1 text-[#E10600] font-bold">
            <TrendingDown className="w-3.5 h-3.5" />
            -{spot.elevationDropM} м ({spot.avgGradePercent}%)
          </span>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative w-full h-36 select-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-full overflow-visible cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id={`elevGrad-${spot.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#E10600" stopOpacity="0.5" />
              <stop offset="55%" stopColor="#FFC400" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#060608" stopOpacity="0" />
            </linearGradient>
            <filter id="glow-line">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
              <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Horizontal grid lines */}
          {[0, 0.5, 1].map((t, i) => {
            const y = PAD_Y + t * (H - PAD_Y * 2);
            const elev = Math.round(maxElev - t * elevRange);
            return (
              <g key={i}>
                <line x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke="#252535" strokeWidth="1" strokeDasharray="3 3" />
                <text x={PAD_X - 4} y={y + 3} fontSize="8" fill="#3a4255" textAnchor="end" fontFamily="monospace">{elev}</text>
              </g>
            );
          })}

          {/* Ground line */}
          <line x1={PAD_X} y1={H - PAD_Y} x2={W - PAD_X} y2={H - PAD_Y} stroke="#3a4255" strokeWidth="1" />

          {/* Filled area */}
          <polygon points={areaPts} fill={`url(#elevGrad-${spot.id})`} />

          {/* Profile line with glow */}
          <polyline
            points={linePts}
            fill="none"
            stroke="#E10600"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow-line)"
          />

          {/* Data points */}
          {points.map((pt, idx) => {
            const cx = toX(pt.distanceKm);
            const cy = toY(pt.elevationM);
            const isHovered = hoveredPoint?.distanceKm === pt.distanceKm;
            return (
              <g key={idx}>
                <line x1={cx} y1={cy} x2={cx} y2={H - PAD_Y} stroke="#3a4255" strokeWidth="1" strokeDasharray="2 2" />
                <circle cx={cx} cy={cy} r={isHovered ? 5 : 3} fill={isHovered ? '#FFC400' : '#E10600'} stroke={isHovered ? '#fff' : '#060608'} strokeWidth="1.5" />
                {pt.label && (
                  <text
                    x={cx}
                    y={cy - 10}
                    fontSize="8.5"
                    fill={isHovered ? '#fff' : '#6b7a94'}
                    fontWeight={isHovered ? 'bold' : 'normal'}
                    textAnchor={idx === 0 ? 'start' : idx === points.length - 1 ? 'end' : 'middle'}
                    fontFamily="monospace"
                  >
                    {pt.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Hover crosshair line */}
          {hoverX !== null && (
            <line
              x1={hoverX} y1={PAD_Y}
              x2={hoverX} y2={H - PAD_Y}
              stroke="#FFC400"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.6"
            />
          )}
        </svg>
      </div>

      {/* Footer axis */}
      <div className="flex items-center justify-between text-[9px] text-[#6b7a94] font-mono px-2 mt-1">
        <span>0 км</span>
        {hoveredPoint ? (
          <span className="text-[#FFC400] font-bold transition-all">
            {hoveredPoint.label ? `${hoveredPoint.label} · ` : ''}
            {hoveredPoint.distanceKm} км · {hoveredPoint.elevationM} м н.р.м.
          </span>
        ) : (
          <span className="text-[#3a4255]">← наведи курсор для перегляду точок</span>
        )}
        <span>{maxDist} км</span>
      </div>
    </div>
  );
};
