import { Pencil, Trash2 } from "lucide-react";
import type { FixedCommitment, ValidationIssue } from "../../domain/types";
import { InlineIssues } from "../common/IssueList";
import { describeCommitment } from "../../utils/commitments";

interface Props {
  commitments: readonly FixedCommitment[];
  issues: readonly ValidationIssue[];
  onEdit: (c: FixedCommitment) => void;
  onRemove: (id: string) => void;
}

export function CommitmentList({ commitments, issues, onEdit, onRemove }: Props) {
  if (!commitments.length) return <p className="empty-note">No commitments yet. Add routines or appointments that already take up your time.</p>;
  return (
    <ul className="commitment-list">
      {commitments.map(c => (
        <li key={c.id} className="commitment-item">
          <div className="commitment-main">
            <strong>{c.title.trim() || "Untitled commitment"}</strong>
            <span>{describeCommitment(c)}</span>
            <InlineIssues issues={issues.filter(i => i.entityId === c.id)} />
          </div>
          <div className="commitment-actions">
            <button type="button" className="icon-button" aria-label={`Edit ${c.title || "commitment"}`} onClick={() => onEdit(c)}><Pencil size={16} aria-hidden="true" /></button>
            <button type="button" className="icon-button danger" aria-label={`Delete ${c.title || "commitment"}`} onClick={() => onRemove(c.id)}><Trash2 size={16} aria-hidden="true" /></button>
          </div>
        </li>
      ))}
    </ul>
  );
}
