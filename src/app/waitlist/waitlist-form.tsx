"use client";

import { joinWaitlist, type JoinWaitlistState } from "@/app/waitlist/actions";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

const initial: JoinWaitlistState = { error: null, success: null };

type WaitlistFormProps = {
  email?: string;
};

export function WaitlistForm({ email = "" }: WaitlistFormProps) {
  const [state, action] = useActionState(joinWaitlist, initial);

  if (state.success) {
    return (
      <p className="text-sm leading-relaxed text-muted-foreground">{state.success}</p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="sr-only"
        defaultValue=""
      />
      <FormField
        id="waitlist-name"
        name="name"
        label="Name"
        autoComplete="name"
      />
      <FormField
        id="waitlist-email"
        name="email"
        label="Email"
        type="email"
        defaultValue={email}
        autoComplete="email"
      />
      <FormField
        id="waitlist-position"
        name="position"
        label="Position"
        placeholder="Principal, technologist, intern"
        autoComplete="organization-title"
      />
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Submit />
      <p className="text-sm text-muted-foreground">One letter. No brochure.</p>
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
      {pending ? "Joining..." : "Put my name on the list"}
    </Button>
  );
}
