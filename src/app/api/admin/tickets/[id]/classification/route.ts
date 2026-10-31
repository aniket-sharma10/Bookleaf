import { dataResponse, withApi } from "@/server/http/handler";
import { retryClassification } from "@/server/services/admin-tickets";

// Retry AI classification now; never overwrites an admin's category/priority.
export const POST = withApi<{ id: string }>(
  async (_request, { params }) =>
    dataResponse(await retryClassification(params.id)),
  { access: "ADMIN" },
);
