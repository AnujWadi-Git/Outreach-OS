import { Badge } from "@/components/ui/badge";

const successStatuses = new Set([
  "GENERATED",
  "DRAFT_CREATED",
  "DRAFTED",
  "SENT",
  "SUCCESS",
]);
const warningStatuses = new Set([
  "NEW",
  "PARSED",
  "ANALYZED",
  "DRAFTING",
  "SENDING",
  "NEEDS_REVIEW",
  "SCHEDULED",
  "PARTIAL",
  "DRY_RUN",
]);
const destructiveStatuses = new Set(["FAILED", "SKIPPED"]);

export function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, " ").toLowerCase();
  const variant = successStatuses.has(status)
    ? "success"
    : destructiveStatuses.has(status)
      ? "destructive"
      : warningStatuses.has(status)
        ? "warning"
        : "secondary";

  return (
    <Badge variant={variant}>
      <span className="capitalize">{label}</span>
    </Badge>
  );
}
