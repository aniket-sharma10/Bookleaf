import { createMessageSchema } from "@/lib/schemas/tickets";
import { dataResponse, withApi } from "@/server/http/handler";
import { parseJson } from "@/server/http/request";
import { sendReply } from "@/server/services/admin-tickets";

// Send a reply the author will see, optionally changing the status.
export const POST = withApi<{ id: string }>(
  async (request, { params, user }) => {
    const input = await parseJson(request, createMessageSchema);
    return dataResponse(await sendReply(params.id, input, user.id), 201);
  },
  { access: "ADMIN" },
);
