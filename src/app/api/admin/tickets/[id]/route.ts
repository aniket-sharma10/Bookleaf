import { dataResponse, withApi } from "@/server/http/handler";
import { getTicketForAdmin } from "@/server/services/admin-tickets";

// One ticket with author, book, thread, internal notes and AI metadata.
export const GET = withApi<{ id: string }>(
  async (_request, { params }) =>
    dataResponse(await getTicketForAdmin(params.id)),
  { access: "ADMIN" },
);
