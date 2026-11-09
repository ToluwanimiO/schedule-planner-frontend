import { AlertCircle, AlertTriangle } from "lucide-react";
import type { ValidationIssue } from "../../domain/types";

/** Compact list of validation issues. Errors use role=alert; warnings are polite. */
export function IssueList({ issues, title }: { issues: readonly ValidationIssue[]; title?: string }) {
  if (!issues.length) return null;
  const errors = issues.filter(i => i.severity === "error");
  const warnings = issues.filter(i => i.severity === "warning");
  return (
    <div className="issue-list">
      {errors.length > 0 && (
        <div className="notice error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <div><strong>{title ?? (errors.length === 1 ? "One thing to fix" : `${errors.length} things to fix`)}</strong>
            <ul>{errors.map(i => <li key={i.id}>{i.message}</li>)}</ul></div>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="notice warning" role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          <div><strong>Worth checking</strong><ul>{warnings.map(i => <li key={i.id}>{i.message}</li>)}</ul></div>
        </div>
      )}
    </div>
  );
}

export function InlineIssues({ issues }: { issues: readonly ValidationIssue[] }) {
  if (!issues.length) return null;
  return <ul className="inline-issues">{issues.map(i => <li key={i.id} className={i.severity}>{i.message}</li>)}</ul>;
}
