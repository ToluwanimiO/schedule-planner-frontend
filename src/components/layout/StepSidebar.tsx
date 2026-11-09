import { Check } from "lucide-react";
import { WIZARD_STEPS } from "../../domain/constants";

interface Props { currentIndex: number; maxReached: number; onSelect: (index: number) => void }

export function StepSidebar({ currentIndex, maxReached, onSelect }: Props) {
  return (
    <aside className="sidebar">
      <p className="eyebrow">Weekly planner</p>
      <h1>Make room for what matters.</h1>
      <nav aria-label="Planning steps">
        <ol className="step-nav">
          {WIZARD_STEPS.map((s, i) => {
            const done = i <= maxReached && i !== currentIndex;
            return (
              <li key={s.id}>
                <button
                  type="button" className={`step-nav-item${i === currentIndex ? " active" : ""}${done ? " complete" : ""}`}
                  aria-current={i === currentIndex ? "step" : undefined} disabled={i > maxReached} onClick={() => onSelect(i)}
                >
                  <span className="step-icon" aria-hidden="true">{done ? <Check size={15} /> : i + 1}</span>
                  <span className="step-label"><strong>{s.label}</strong><small>{s.hint}</small></span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </aside>
  );
}
