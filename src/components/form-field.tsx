"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

const COPY: Record<string, { missing: string; mismatch: string }> = {
  email: {
    missing: "Enter the email you use at work.",
    mismatch: "Write an email address.",
  },
  name: {
    missing: "Write your name as you use it at work.",
    mismatch: "Write your name as you use it at work.",
  },
  position: {
    missing: "Say the seat you occupy. Principal, technologist, intern.",
    mismatch: "Say the seat you occupy. Principal, technologist, intern.",
  },
};

function messageFor(input: HTMLInputElement) {
  const copy = COPY[input.name] ?? {
    missing: "Fill in this field.",
    mismatch: "Fill in this field.",
  };
  if (input.validity.valueMissing) return copy.missing;
  if (input.validity.typeMismatch) return copy.mismatch;
  return copy.mismatch;
}

export function FormField({
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
  const [error, setError] = useState<string | null>(null);
  const errorId = `${id}-error`;

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
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onInvalid={(event) => {
          event.preventDefault();
          setError(messageFor(event.currentTarget));
        }}
        onInput={(event) => {
          if (event.currentTarget.validity.valid) setError(null);
        }}
      />
      {error ? (
        <p id={errorId} className="text-sm text-destructive" aria-live="polite">
          {error}
        </p>
      ) : null}
    </div>
  );
}
