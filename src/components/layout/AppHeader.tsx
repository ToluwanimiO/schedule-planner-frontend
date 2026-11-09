import { RotateCcw, Sparkles } from "lucide-react";

export function AppHeader({ onReset }: { onReset: () => void }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true"><Sparkles size={18} /></span>
        <span>weekwell<span className="brand-dot">.</span></span>
      </div>
      <div className="topbar-right">
        <span className="save-status">Kept in this browser tab only — refreshing clears it</span>
        <button
          type="button" className="text-button"
          onClick={() => { if (window.confirm("Start over? This clears your goals, tasks and timetable.")) onReset(); }}
        >
          <RotateCcw size={16} aria-hidden="true" /> Start over
        </button>
      </div>
    </header>
  );
}
