import { PreferencesStep } from "./components/preferences/PreferencesStep";
import { AvailabilityStep } from "./components/availability/AvailabilityStep";
import { GoalsStep } from "./components/goals/GoalsStep";
import { WizardLayout } from "./components/layout/WizardLayout";
import { ReviewStep } from "./components/review/ReviewStep";
import { ScheduleStep } from "./components/schedule/ScheduleStep";
import { TasksStep } from "./components/tasks/TasksStep";
import { WIZARD_STEPS } from "./domain/constants";
import type { WizardStepId } from "./domain/types";
import { useSchedulePlanner } from "./hooks/useSchedulePlanner";

/** Composes the wizard. All state lives in useSchedulePlanner; all rendering lives in the step components. */
export default function App() {
  const p = useSchedulePlanner();
  const goToStep = (id: WizardStepId) => p.goTo(WIZARD_STEPS.findIndex(s => s.id === id));
  const onReview = p.currentStep === "review";
  const onSchedule = p.currentStep === "schedule";

  return (
    <WizardLayout
      stepIndex={p.stepIndex} maxReached={p.maxReached} onSelectStep={p.goTo} onReset={p.reset}
      onBack={onSchedule ? undefined : p.back}
      onNext={onSchedule ? undefined : onReview ? p.generate : () => { p.next(); }}
      nextLabel={onReview ? "Generate timetable" : "Continue"} nextIsGenerate={onReview}
    >
      {p.currentStep === "goals" && (
        <GoalsStep goals={p.goals} tasks={p.tasks} issues={p.stepIssues("goals")} onAdd={p.addGoal} onUpdate={p.updateGoal} onRemove={p.removeGoal} />
      )}
      {p.currentStep === "tasks" && (
        <TasksStep goals={p.goals} tasks={p.tasks} issues={p.stepIssues("tasks")} onAdd={p.addTask} onChange={p.updateTask} onRemove={p.removeTask} />
      )}
      {p.currentStep === "availability" && (
        <AvailabilityStep
          availability={p.availability} commitments={p.commitments} weekStart={p.weekStart} issues={p.stepIssues("availability")}
          onAddWindow={p.addWindow} onUpdateWindow={p.updateWindow} onRemoveWindow={p.removeWindow}
          onSaveCommitment={p.saveCommitment} onRemoveCommitment={p.removeCommitment}
          onSetWeekStart={p.setWeekStart} onShiftWeek={p.shiftWeek}
        />
      )}
      {p.currentStep === "preferences" && (
        <PreferencesStep
          goals={p.goals} tasks={p.tasks} strategy={p.strategy} mode={p.mode}
          onStrategy={p.setStrategy} onMode={p.setMode} onTaskChange={p.updateTask} onEditTasks={() => goToStep("tasks")}
        />
      )}
      {onReview && <ReviewStep input={p.input} mode={p.mode} issues={p.issues} onEdit={goToStep} />}
      {onSchedule && (
        <ScheduleStep status={p.status} error={p.error} generated={p.generated} stale={p.stale} onGenerate={p.generate} onEditPlan={() => goToStep("review")} />
      )}
    </WizardLayout>
  );
}
