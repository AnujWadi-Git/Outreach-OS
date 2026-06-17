"use client";

import { Mail } from "lucide-react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton() {
  return (
    <Button
      type="button"
      size="lg"
      onClick={() => signIn("google", { callbackUrl: "/" })}
    >
      <Mail />
      Continue with Google
    </Button>
  );
}
