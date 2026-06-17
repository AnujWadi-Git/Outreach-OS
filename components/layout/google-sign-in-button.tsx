"use client";

import { Mail } from "lucide-react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      size="lg"
      disabled={disabled}
      onClick={() => signIn("google", { callbackUrl: "/" })}
    >
      <Mail />
      {disabled ? "Google OAuth not configured" : "Continue with Google"}
    </Button>
  );
}
