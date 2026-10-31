import { dataResponse, withApi } from "@/server/http/handler";
import { consumeRateLimit, RATE_LIMITS } from "@/server/http/rate-limit";
import { retryClassification } from "@/server/services/admin-tickets";

// Retry AI classification now; never overwrites an admin's category/priority.
export const POST = withApi<{ id: string }>(
  async (_request, { params, user }) => {
    await consumeRateLimit(RATE_LIMITS.ai, user.id);
    return dataResponse(await retryClassification(params.id));
  },
  { access: "ADMIN" },
);
