import { updateTicketSchema } from "@/lib/schemas/tickets";
import { dataResponse, withApi } from "@/server/http/handler";
import { parseJson } from "@/server/http/request";
import {
  getTicketForAdmin,
  updateTicket,
} from "@/server/services/admin-tickets";

// One ticket with author, book, thread, internal notes and AI metadata.
export const GET = withApi<{ id: string }>(
  async (_request, { params }) =>
    dataResponse(await getTicketForAdmin(params.id)),
  { access: "ADMIN" },
);

// Status, category/priority overrides and "assign to me"; returns the ticket.
export const PATCH = withApi<{ id: string }>(
  async (request, { params, user }) => {
    const changes = await parseJson(request, updateTicketSchema);
    return dataResponse(await updateTicket(params.id, changes, user.id));
  },
  { access: "ADMIN" },
);
