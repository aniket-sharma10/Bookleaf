import { loginSchema } from "@/lib/schemas/auth";
import { setAuthCookie } from "@/server/auth/cookie";
import { signAuthToken } from "@/server/auth/jwt";
import { dataResponse, withApi } from "@/server/http/handler";
import { parseJson } from "@/server/http/request";
import { authenticate } from "@/server/services/auth";

// The only PUBLIC route. The token goes only into the HttpOnly cookie; the
// body returns the user, never the token.
export const POST = withApi(
  async (request) => {
    const credentials = await parseJson(request, loginSchema);
    const user = await authenticate(credentials);
    const response = dataResponse(user);
    setAuthCookie(response, await signAuthToken(user));
    return response;
  },
  { access: "PUBLIC" },
);
