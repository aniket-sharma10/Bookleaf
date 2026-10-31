import { createTicketSchema } from "@/lib/schemas/tickets";
import { dataResponse, withApi } from "@/server/http/handler";
import { consumeRateLimit, RATE_LIMITS } from "@/server/http/rate-limit";
import { parseJson } from "@/server/http/request";
import {
  createTicket,
  listTicketsForAuthor,
} from "@/server/services/author-tickets";

// The signed-in author's tickets, newest activity first.
export const GET = withApi(
  async (_request, { user }) =>
    dataResponse(await listTicketsForAuthor(user.authorId)),
  { access: "AUTHOR" },
);

// Raise a support query. authorId comes from the token, never the body.
export const POST = withApi(
  async (request, { user }) => {
    const input = await parseJson(request, createTicketSchema);
    await consumeRateLimit(RATE_LIMITS.ticketCreate, user.authorId);
    return dataResponse(await createTicket(user.authorId, input), 201);
  },
  { access: "AUTHOR" },
);
