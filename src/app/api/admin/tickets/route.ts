import { queueQuerySchema } from "@/lib/schemas/tickets";
import { pageResponse, withApi } from "@/server/http/handler";
import { parseQuery } from "@/server/http/request";
import { listQueue } from "@/server/services/admin-tickets";

// The support queue: filters and paging come from the query string.
export const GET = withApi(
  async (request, { user }) => {
    const query = parseQuery(request.url, queueQuerySchema);
    const { data, ...meta } = await listQueue(query, user.id);
    return pageResponse(data, meta);
  },
  { access: "ADMIN" },
);
