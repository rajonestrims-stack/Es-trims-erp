import React from 'react';
import { UPSCalculationResult, DimensionUnit, convertMmToUnit } from '../../lib/upsCalculator';

interface ImpositionPreviewProps {
  result: UPSCalculationResult;
  productName?: string;
  paperUnit: DimensionUnit;
  productUnit: DimensionUnit;
  orientationOverride?: 'PORTRAIT' | 'LANDSCAPE' | 'BEST';
  title?: string;
  showDetails?: boolean;
}

export const ImpositionPreview: React.FC<ImpositionPreviewProps> = ({
  result,
  productName = 'Product',
  paperUnit,
  productUnit,
  orientationOverride = 'BEST',
  title,
  showDetails = true,
}) => {
  if (!result.isValid) {
    return (
      <div className="w-full h-64 bg-neutral-50 border-2 border-dashed border-neutral-200 rounded-xl flex flex-col items-center justify-center p-6 text-center text-neutral-400">
        <svg className="w-10 h-10 mb-2 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-sm font-medium">{result.errorMessage || 'Invalid dimensions for preview'}</p>
      </div>
    );
  }

  const selectedOrientation = orientationOverride === 'BEST'
    ? result.bestOrientation
    : orientationOverride;

  const currentCalc = selectedOrientation === 'PORTRAIT' ? result.portrait : result.landscape;
  const isBest = selectedOrientation === result.bestOrientation;

  // Scaling setup for SVG preview
  const paperW = result.paperWidthMm;
  const paperH = result.paperHeightMm;
  
  // Usable area
  const marginLR = (paperW - result.usablePaperWidthMm) / 2;
  const marginTB = (paperH - result.usablePaperHeightMm) / 2; // approximation for top/bottom
  
  const cols = currentCalc.columns;
  const rows = currentCalc.rows;
  const itemW = currentCalc.productWidthMm;
  const itemH = currentCalc.productHeightMm;

  // Render grid of items
  const items = [];
  if (cols > 0 && rows > 0) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        items.push({ row: r, col: c });
      }
    }
  }

  const paperWidthDisplay = convertMmToUnit(paperW, paperUnit).toFixed(1);
  const paperHeightDisplay = convertMmToUnit(paperH, paperUnit).toFixed(1);

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm flex flex-col h-full">
      {title && (
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-3">
          <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">{title}</h4>
          {isBest && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              BEST OPTION
            </span>
          )}
        </div>
      )}

      {/* SVG Canvas Container */}
      <div className="relative flex-1 min-h-[220px] w-full bg-neutral-900/5 rounded-xl p-3 flex items-center justify-center overflow-hidden">
        <svg
          viewBox={`0 0 ${paperW} ${paperH}`}
          className="max-w-full max-h-[280px] filter drop-shadow-md transition-all duration-300"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Paper Sheet Base */}
          <rect
            x={0}
            y={0}
            width={paperW}
            height={paperH}
            fill="#FFFFFF"
            stroke="#CBD5E1"
            strokeWidth={Math.max(1, paperW / 300)}
            rx={paperW / 100}
          />

          {/* Gripper Zone Stripe */}
          <rect
            x={0}
            y={0}
            width={paperW}
            height={paperH - result.usablePaperHeightMm - marginTB}
            fill="#FEF3C7"
            fillOpacity={0.6}
            stroke="#F59E0B"
            strokeWidth={Math.max(0.5, paperW / 500)}
            strokeDasharray={`${paperW / 100},${paperW / 100}`}
          />

          {/* Usable Area Border */}
          <rect
            x={marginLR}
            y={paperH - result.usablePaperHeightMm - marginTB}
            width={result.usablePaperWidthMm}
            height={result.usablePaperHeightMm}
            fill="none"
            stroke="#94A3B8"
            strokeWidth={Math.max(0.5, paperW / 400)}
            strokeDasharray={`${paperW / 80},${paperW / 80}`}
          />

          {/* Render Products */}
          {items.map((item, idx) => {
            // position
            const x = marginLR + item.col * (itemW + 2); // gap approx 2mm for visual
            const y = (paperH - result.usablePaperHeightMm - marginTB) + item.row * (itemH + 2);

            return (
              <g key={idx}>
                <rect
                  x={x}
                  y={y}
                  width={itemW}
                  height={itemH}
                  fill={isBest ? '#EEF2FF' : '#F8FAFC'}
                  stroke={isBest ? '#6366F1' : '#64748B'}
                  strokeWidth={Math.max(0.5, paperW / 400)}
                  rx={Math.min(itemW, itemH) / 15}
                />
                {/* Product label inside rect if big enough */}
                {cols <= 8 && rows <= 8 && (
                  <text
                    x={x + itemW / 2}
                    y={y + itemH / 2}
                    fill={isBest ? '#4338CA' : '#475569'}
                    fontSize={Math.min(itemW / 4, itemH / 3, paperW / 30)}
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    #{idx + 1}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {showDetails && (
        <div className="mt-3 pt-3 border-t border-neutral-100 text-xs space-y-1 text-neutral-600">
          <div className="flex justify-between font-semibold text-neutral-800">
            <span>Orientation: <strong className="text-indigo-600">{selectedOrientation}</strong></span>
            <span>Total UPS: <strong className="text-neutral-900 text-sm">{currentCalc.ups}</strong></span>
          </div>
          <div className="flex justify-between text-neutral-500">
            <span>Grid Layout: {currentCalc.columns} Cols × {currentCalc.rows} Rows</span>
            <span>Paper: {paperWidthDisplay} × {paperHeightDisplay} {paperUnit}</span>
          </div>
        </div>
      )}
    </div>
  );
};
