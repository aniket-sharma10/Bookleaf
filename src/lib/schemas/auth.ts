import { z } from "zod";

// Shared by the login form and POST /api/auth/login.
export const loginSchema = z.object({
  // Stored emails are lowercase, so the input is normalised to match them.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
  // Upper bound only to reject absurd payloads; bcrypt reads the first 72 bytes.
  password: z.string().min(1, "Enter your password.").max(256),
});

export type LoginInput = z.infer<typeof loginSchema>;
