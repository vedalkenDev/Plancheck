"use client";

import { joinWaitlist, type JoinWaitlistState } from "@/app/waitlist/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <Field
        id="waitlist-name"
        name="name"
        label="Name"
        autoComplete="name"
      />
      <Field
        id="waitlist-email"
        name="email"
        label="Email"
        type="email"
        defaultValue={email}
        autoComplete="email"
      />
      <Field
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
    </form>
  );
}

function Field({
  id,
  name,
  label,
  type = "text",
  defaultValue,
  placeholder,
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  type?: "text" | "email";
  defaultValue?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
      />
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" size="lg" type="submit" disabled={pending}>
      {pending ? "Joining..." : "Put my name on the list"}
    </Button>
  );
}
