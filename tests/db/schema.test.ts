import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { seedDataset } from "../../prisma/dataset";
import { edgeCaseRawDataset, toDataset } from "../fixtures/synthetic-dataset";
import { connectTestDb, truncateAllTables } from "../helpers/test-db-client";

// Checks that the migrated schema enforces what architecture §3 and ADR-0005
// say it does. Synthetic data only.
let db: PrismaClient;
beforeAll(async () => {
  db = await connectTestDb();
});
beforeEach(async () => {
  await truncateAllTables(db);
  await seedDataset(db, toDataset(edgeCaseRawDataset()));
});
afterAll(() => db.$disconnect());

function admin(id: string) {
  return db.user.create({
    data: {
      id,
      email: `${id}@example.test`,
      passwordHash: "x",
      role: "ADMIN",
      name: id,
    },
  });
}

describe("migrated schema", () => {
  it("has every migration in prisma/migrations applied and nothing else", async () => {
    const rows = await db.$queryRaw<
      { migration_name: string; done: boolean }[]
    >`
      select migration_name, finished_at is not null as done
      from _prisma_migrations order by migration_name`;
    const onDisk = readdirSync(resolve(process.cwd(), "prisma/migrations"), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(rows.map((row) => row.migration_name)).toEqual(onDisk);
    expect(onDisk[0]).toMatch(/_init$/);
    expect(rows.every((row) => row.done)).toBe(true);
  });

  it("ties User.role to User.authorId with a CHECK constraint", async () => {
    await expect(
      db.user.create({
        data: {
          email: "a@example.test",
          passwordHash: "x",
          role: "AUTHOR",
          name: "A",
        },
      }),
    ).rejects.toThrow(/User_role_authorId_check/);
    await expect(
      db.user.create({
        data: {
          email: "b@example.test",
          passwordHash: "x",
          role: "ADMIN",
          name: "B",
          authorId: "A1",
        },
      }),
    ).rejects.toThrow(/User_role_authorId_check/);

    await expect(
      db.user.create({
        data: {
          email: "c@example.test",
          passwordHash: "x",
          role: "AUTHOR",
          name: "C",
          authorId: "A1",
        },
      }),
    ).resolves.toMatchObject({ role: "AUTHOR", authorId: "A1" });
    await expect(admin("admin1")).resolves.toMatchObject({ authorId: null });
  });

  it("sorts priority Critical → Low through the enum order", async () => {
    for (const priority of ["LOW", "CRITICAL", "MEDIUM", "HIGH"] as const) {
      await db.ticket.create({
        data: { authorId: "A1", subject: priority, description: "d", priority },
      });
    }
    const tickets = await db.ticket.findMany({ orderBy: { priority: "asc" } });
    expect(tickets.map((t) => t.priority)).toEqual([
      "CRITICAL",
      "HIGH",
      "MEDIUM",
      "LOW",
    ]);
  });

  it("defaults new tickets to OPEN and classification PENDING", async () => {
    const ticket = await db.ticket.create({
      data: { authorId: "A1", bookId: "B1", subject: "s", description: "d" },
    });
    expect(ticket).toMatchObject({
      status: "OPEN",
      classificationStatus: "PENDING",
      category: null,
      priority: null,
      assigneeId: null,
    });
  });

  it("enforces unique ISBNs", async () => {
    await expect(
      db.book.update({
        where: { id: "B2" },
        data: { isbn: "000-00-0XXXX-00-0" },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("restricts deleting dataset records that are still referenced", async () => {
    await expect(db.author.delete({ where: { id: "A1" } })).rejects.toThrow();
    await db.ticket.create({
      data: { authorId: "A2", bookId: "B3", subject: "s", description: "d" },
    });
    await expect(db.book.delete({ where: { id: "B3" } })).rejects.toThrow();
  });

  it("cascades ticket deletion to messages, notes and drafts", async () => {
    const staff = await admin("admin2");
    const ticket = await db.ticket.create({
      data: { authorId: "A1", subject: "s", description: "d" },
    });
    await db.ticketMessage.create({
      data: { ticketId: ticket.id, senderId: staff.id, body: "reply" },
    });
    await db.internalNote.create({
      data: { ticketId: ticket.id, createdById: staff.id, body: "note" },
    });
    await db.aiDraft.create({
      data: {
        ticketId: ticket.id,
        body: "draft",
        commitments: [],
        needsVerification: [],
        warnings: [],
        model: "test-model",
        promptVersion: "v0",
        createdById: staff.id,
      },
    });

    await db.ticket.delete({ where: { id: ticket.id } });
    expect(await db.ticketMessage.count()).toBe(0);
    expect(await db.internalNote.count()).toBe(0);
    expect(await db.aiDraft.count()).toBe(0);
  });

  it("clears the assignee when that user is deleted", async () => {
    const staff = await admin("admin3");
    const ticket = await db.ticket.create({
      data: {
        authorId: "A1",
        subject: "s",
        description: "d",
        assigneeId: staff.id,
      },
    });
    await db.user.delete({ where: { id: staff.id } });
    const after = await db.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    expect(after.assigneeId).toBeNull();
  });
});
