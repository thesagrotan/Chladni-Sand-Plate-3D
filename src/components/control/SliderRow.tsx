import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  digits?: number;
  formatFn?: (val: number) => string;
  onChange: (val: number) => void;
}

export const SliderRow: React.FC<SliderRowProps> = ({
  label,
  value,
  min,
  max,
  step,
  digits = 2,
  formatFn,
  onChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputVal, setInputVal] = useState(value.toString());

  useEffect(() => {
    if (!isEditing) {
      setInputVal(value.toFixed(digits));
    }
  }, [value, digits, isEditing]);

  const displayVal = formatFn ? formatFn(value) : value.toFixed(digits);

  const handleStep = (direction: -1 | 1) => {
    const nextVal = Math.min(max, Math.max(min, +(value + direction * step).toFixed(digits)));
    onChange(nextVal);
  };

  const handleCommitInput = () => {
    setIsEditing(false);
    const parsed = parseFloat(inputVal);
    if (!isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, +parsed.toFixed(digits)));
      onChange(clamped);
    } else {
      setInputVal(value.toFixed(digits));
    }
  };

  return (
    <div className="flex flex-col gap-1 py-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-neutral-400 font-normal truncate max-w-[170px]" title={label}>
          {label}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => handleStep(-1)}
            className="w-4 h-4 flex items-center justify-center rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Decrease"
          >
            <ChevronLeft size={11} />
          </button>
          {isEditing ? (
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onBlur={handleCommitInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCommitInput();
                if (e.key === 'Escape') {
                  setIsEditing(false);
                  setInputVal(value.toFixed(digits));
                }
              }}
              autoFocus
              className="w-13 text-center font-mono text-cyan-300 text-[10px] bg-neutral-900 px-0.5 py-0 rounded border border-cyan-500 focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              title="Click to type exact number"
              className="w-13 text-center font-mono text-neutral-200 text-[10px] bg-neutral-900/90 hover:bg-neutral-800/90 px-0.5 py-0 rounded border border-neutral-800/80 cursor-text truncate transition-colors"
            >
              {displayVal}
            </button>
          )}
          <button
            type="button"
            onClick={() => handleStep(1)}
            className="w-4 h-4 flex items-center justify-center rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Increase"
          >
            <ChevronRight size={11} />
          </button>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition-[background-color,border-color,color,opacity,transform,box-shadow]"
      />
    </div>
  );
};
