import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ContactEditorDialog } from "@/components/campaigns/contact-editor-dialog";
import { StatusBadge } from "@/components/campaigns/status-badge";

export type ParsedContactRow = {
  id: string;
  campaignId: string;
  fullName: string | null;
  email: string | null;
  title: string | null;
  company: string | null;
  confidence: number;
  isValid: boolean;
  validityReason: string | null;
  status: string;
  lastError: string | null;
};

export function ParsedContactsTable({
  contacts,
}: {
  contacts: ParsedContactRow[];
}) {
  if (contacts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No contacts were parsed from the pasted source text.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Contact</TableHead>
          <TableHead>Context</TableHead>
          <TableHead>Confidence</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Issue</TableHead>
          <TableHead className="w-24" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {contacts.map((contact) => (
          <TableRow key={contact.id}>
            <TableCell>
              <div className="font-medium">{contact.fullName || "Needs name"}</div>
              <div className="text-xs text-muted-foreground">
                {contact.email || "Missing email"}
              </div>
            </TableCell>
            <TableCell>
              <div>{contact.title || "Title unknown"}</div>
              <div className="text-xs text-muted-foreground">
                {contact.company || "Company unknown"}
              </div>
            </TableCell>
            <TableCell>{Math.round(contact.confidence * 100)}%</TableCell>
            <TableCell>
              <StatusBadge status={contact.status} />
            </TableCell>
            <TableCell className="max-w-xs text-xs leading-5 text-muted-foreground">
              {contact.lastError || contact.validityReason || "Ready"}
            </TableCell>
            <TableCell>
              <ContactEditorDialog contact={contact} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
