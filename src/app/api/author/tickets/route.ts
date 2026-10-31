import { createTicketSchema } from "@/lib/schemas/tickets";
import { dataResponse, withApi } from "@/server/http/handler";
import { parseJson } from "@/server/http/request";
import { createTicket } from "@/server/services/author-tickets";

// Raise a support query. authorId comes from the token, never the body.
export const POST = withApi(
  async (request, { user }) => {
    const input = await parseJson(request, createTicketSchema);
    return dataResponse(await createTicket(user.authorId, input), 201);
  },
  { access: "AUTHOR" },
);
