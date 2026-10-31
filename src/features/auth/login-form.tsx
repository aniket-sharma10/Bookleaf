"use client";

import { CircleAlert, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError, apiRequest, type FieldIssue } from "@/lib/api-client";
import { portalPath, type SessionUser } from "@/lib/routes";
import { loginSchema } from "@/lib/schemas/auth";

type Field = "email" | "password";
type FieldErrors = Partial<Record<Field, string>>;
type FormError = { title: string; message: string };

const FIELDS: Field[] = ["email", "password"];

/** First message per field, from client (Zod) or server (`details`) issues. */
function toFieldErrors(issues: FieldIssue[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const { path, message } of issues) {
    const field = FIELDS.find((name) => name === path);
    if (field && !errors[field]) errors[field] = message;
  }
  return errors;
}

function toFormError(error: unknown): FormError {
  if (error instanceof ApiClientError && error.status === 401) {
    return {
      title: "We couldn't sign you in",
      message: "That email and password don't match. Check them and try again.",
    };
  }
  if (error instanceof ApiClientError && error.code === "NETWORK_ERROR") {
    return { title: "Connection problem", message: error.message };
  }
  return {
    title: "Something went wrong",
    message: "We couldn't sign you in just now. Please try again in a moment.",
  };
}

export function LoginForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<FormError | null>(null);

  function showFieldErrors(errors: FieldErrors) {
    setFieldErrors(errors);
    // Move focus to the first field that needs attention.
    const first = FIELDS.find((field) => errors[field]);
    if (first)
      formRef.current?.querySelector<HTMLInputElement>(`#${first}`)?.focus();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({
      email: form.get("email") ?? "",
      password: form.get("password") ?? "",
    });
    if (!parsed.success) {
      showFieldErrors(
        toFieldErrors(
          parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        ),
      );
      return;
    }

    setFieldErrors({});
    setPending(true);
    try {
      const user = await apiRequest<SessionUser>("/api/auth/login", {
        method: "POST",
        body: parsed.data,
      });
      // Stay in the pending state until the portal has loaded.
      router.replace(portalPath(user.role));
      router.refresh();
    } catch (error) {
      setPending(false);
      if (error instanceof ApiClientError && error.details?.length) {
        showFieldErrors(toFieldErrors(error.details));
      } else {
        setFormError(toFormError(error));
      }
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      aria-busy={pending}
      className="grid gap-5"
    >
      {formError ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>{formError.title}</AlertTitle>
          <AlertDescription>{formError.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          disabled={pending}
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          className="h-10"
        />
        {fieldErrors.email ? (
          <p id="email-error" className="text-sm text-destructive">
            {fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          disabled={pending}
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={fieldErrors.password ? "password-error" : undefined}
          className="h-10"
        />
        {fieldErrors.password ? (
          <p id="password-error" className="text-sm text-destructive">
            {fieldErrors.password}
          </p>
        ) : null}
      </div>

      <Button type="submit" size="lg" disabled={pending} className="h-10">
        {pending ? (
          <>
            <LoaderCircle aria-hidden className="animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}
