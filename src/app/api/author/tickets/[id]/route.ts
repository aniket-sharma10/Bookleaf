import { dataResponse, withApi } from "@/server/http/handler";
import { getTicketForAuthor } from "@/server/services/author-tickets";

// One of the signed-in author's tickets with its replies; 404 for any other.
export const GET = withApi<{ id: string }>(
  async (_request, { user, params }) =>
    dataResponse(await getTicketForAuthor(user.authorId, params.id)),
  { access: "AUTHOR" },
);
