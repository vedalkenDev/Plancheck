"use client";

import { enterEmail, type EnterEmailState } from "@/app/login/actions";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

const initial: EnterEmailState = { error: null };

export function LoginForm() {
  const [state, action] = useActionState(enterEmail, initial);

  return (
    <form action={action} className="space-y-4">
      <FormField
        id="login-email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
      />
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button
      className="h-11 w-full focus-visible:ring-ring md:h-9"
      size="lg"
      type="submit"
      disabled={pending}
    >
      {pending ? "Checking…" : "Continue with email"}
    </Button>
  );
}
