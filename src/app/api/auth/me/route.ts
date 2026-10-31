import { dataResponse, withApi } from "@/server/http/handler";
import { getCurrentUser } from "@/server/services/auth";

export const GET = withApi(
  async (_request, { user }) => dataResponse(await getCurrentUser(user)),
  { access: "AUTHENTICATED" },
);
