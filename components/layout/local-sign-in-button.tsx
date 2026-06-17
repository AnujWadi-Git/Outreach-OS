"use client";

import { MonitorCheck } from "lucide-react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LocalSignInButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={() => signIn("local-owner", { callbackUrl: "/" })}
    >
      <MonitorCheck />
      Continue locally
    </Button>
  );
}
