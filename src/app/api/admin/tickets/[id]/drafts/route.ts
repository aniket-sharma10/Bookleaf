import { generateDraft } from "@/server/ai/draft";
import { dataResponse, withApi } from "@/server/http/handler";

// Generate (or regenerate) an AI draft reply for an admin to edit.
export const POST = withApi<{ id: string }>(
  async (_request, { params, user }) =>
    dataResponse(await generateDraft(params.id, user.id), 201),
  { access: "ADMIN" },
);
