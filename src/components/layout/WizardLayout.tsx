import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { WIZARD_STEPS } from "../../domain/constants";
import { StepSidebar } from "./StepSidebar";

interface Props {
  stepIndex: number;
  maxReached: number;
  onSelectStep: (i: number) => void;
  onReset: () => void;
  /** Footer navigation. Omit `onNext` to hide it (the timetable step has its own actions). */
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextIsGenerate?: boolean;
  children: ReactNode;
}

export function WizardLayout({ stepIndex, maxReached, onSelectStep, onBack, onNext, nextLabel = "Continue", nextIsGenerate, children }: Props) {
  const total = WIZARD_STEPS.length;
  const pct = Math.round(((stepIndex + 1) / total) * 100);
  return (
    <div className="app-shell">
      <main className="main-layout">
        <StepSidebar currentIndex={stepIndex} maxReached={maxReached} onSelect={onSelectStep} />
        <section className="workspace" aria-label={WIZARD_STEPS[stepIndex].label}>
          <div className="workspace-topline"><span>Step {stepIndex + 1} of {total}</span><span>{pct}%</span></div>
          <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Planning progress">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          {children}
          {onNext && (
            <div className="footer-actions">
              <button type="button" className="secondary-button" onClick={onBack} disabled={stepIndex === 0}><ArrowLeft size={16} aria-hidden="true" /> Back</button>
              <button type="button" className="primary-button" onClick={onNext}>
                {nextIsGenerate && <Sparkles size={16} aria-hidden="true" />}{nextLabel}{!nextIsGenerate && <ArrowRight size={16} aria-hidden="true" />}
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
