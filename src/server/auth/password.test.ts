import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("produces a salted bcrypt hash at cost 12, never the plaintext", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).not.toContain("correct horse battery");
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    // Random salt: the same password hashes differently each time.
    expect(await hashPassword("correct horse battery")).not.toBe(hash);
  });

  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse battery");
    await expect(verifyPassword("correct horse battery", hash)).resolves.toBe(
      true,
    );
    await expect(verifyPassword("Correct horse battery", hash)).resolves.toBe(
      false,
    );
  });
});
