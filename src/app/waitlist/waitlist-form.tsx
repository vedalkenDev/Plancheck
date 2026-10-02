"use client";

import { joinWaitlist, type JoinWaitlistState } from "@/app/waitlist/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

const initial: JoinWaitlistState = { error: null };

type WaitlistFormProps = {
  email: string;
  name: string;
};

export function WaitlistForm({ email, name }: WaitlistFormProps) {
  const [state, action] = useActionState(joinWaitlist, initial);

  return (
    <form action={action} className="space-y-4">
      <Field
        id="waitlist-name"
        name="name"
        label="Name"
        defaultValue={name}
        autoComplete="name"
      />
      <Field
        id="waitlist-email"
        label="Email"
        type="email"
        defaultValue={email}
        readOnly
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
  readOnly,
  autoComplete,
}: {
  id: string;
  name?: string;
  label: string;
  type?: "text" | "email";
  defaultValue?: string;
  placeholder?: string;
  readOnly?: boolean;
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
        readOnly={readOnly}
        autoComplete={autoComplete}
        required={!readOnly}
        className={readOnly ? "text-muted-foreground" : undefined}
      />
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" size="lg" type="submit" disabled={pending}>
      {pending ? "Saving the name…" : "Put my name on the list"}
    </Button>
  );
}
