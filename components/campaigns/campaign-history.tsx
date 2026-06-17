"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/campaigns/status-badge";
import { formatDateTime } from "@/lib/utils";

export type CampaignHistoryItem = {
  id: string;
  name: string;
  mode: string;
  status: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  contacts: number;
  drafts: number;
  failures: number;
};

export function CampaignHistory({
  campaigns,
}: {
  campaigns: CampaignHistoryItem[];
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const lower = query.toLowerCase().trim();
    if (!lower) return campaigns;
    return campaigns.filter((campaign) =>
      [
        campaign.name,
        campaign.mode,
        campaign.status,
        String(campaign.contacts),
        String(campaign.drafts),
      ]
        .join(" ")
        .toLowerCase()
        .includes(lower)
    );
  }, [campaigns, query]);

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-lg bg-secondary">
            <Search className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">No campaigns yet</p>
            <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
              Create your first campaign to parse contacts, generate outreach,
              attach your resume, and create Gmail drafts.
            </p>
          </div>
          <Button asChild>
            <Link href="/campaigns/new">Create campaign</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-9"
          placeholder="Search campaigns"
        />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Contacts</TableHead>
                <TableHead>Drafts</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <div className="font-medium">{campaign.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Created {formatDateTime(campaign.createdAt)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={campaign.status} />
                  </TableCell>
                  <TableCell>{campaign.mode.replace(/_/g, " ")}</TableCell>
                  <TableCell>
                    {campaign.contacts}
                    {campaign.failures > 0 ? (
                      <span className="ml-1 text-xs text-destructive">
                        {campaign.failures} failed
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{campaign.drafts}</TableCell>
                  <TableCell>{formatDateTime(campaign.updatedAt)}</TableCell>
                  <TableCell>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/campaigns/${campaign.id}`}>
                        Open
                        <ArrowUpRight />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
