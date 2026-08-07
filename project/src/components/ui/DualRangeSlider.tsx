// Two overlapping native range inputs sharing one track: dragging either thumb moves only
// that value, clamped so low can never pass high and vice versa. Used wherever a
// low%-high% band is configured (Dashboard's estimated-profit-margin editor, the Team ->
// Company profit margin range).
export function DualRangeSlider({ low, high, onLowChange, onHighChange, min = 0, max = 100 }: {
  low: number;
  high: number;
  onLowChange: (value: number) => void;
  onHighChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  const thumbClass =
    "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer " +
    "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:shadow [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none";

  return (
    <div className="relative h-6 flex items-center">
      <div className="absolute inset-x-0 h-1.5 rounded-full bg-slate-200" />
      <div
        className="absolute h-1.5 rounded-full bg-emerald-400"
        style={{ left: `${low}%`, right: `${100 - high}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={low}
        onChange={(e) => onLowChange(Number(e.target.value))}
        className={`absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:border-amber-500 [&::-moz-range-thumb]:border-amber-500 ${thumbClass}`}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={high}
        onChange={(e) => onHighChange(Number(e.target.value))}
        className={`absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:border-emerald-600 [&::-moz-range-thumb]:border-emerald-600 ${thumbClass}`}
      />
    </div>
  );
}
