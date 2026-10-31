import { loginSchema } from "@/lib/schemas/auth";
import { setAuthCookie } from "@/server/auth/cookie";
import { signAuthToken } from "@/server/auth/jwt";
import { dataResponse, withApi } from "@/server/http/handler";
import {
  clientIp,
  consumeRateLimit,
  RATE_LIMITS,
  refundRateLimit,
} from "@/server/http/rate-limit";
import { parseJson } from "@/server/http/request";
import { authenticate } from "@/server/services/auth";

// The only PUBLIC route. The token goes only into the HttpOnly cookie; the
// body returns the user, never the token.
export const POST = withApi(
  async (request) => {
    const credentials = await parseJson(request, loginSchema);
    // Every attempt is counted before the password check, so parallel
    // guesses can't slip past the limit; a successful sign-in is refunded,
    // so only failures add up. Per IP, not per email: a per-account lockout
    // would let anyone lock out the shared demo accounts.
    const ip = clientIp(request);
    await consumeRateLimit(RATE_LIMITS.login, ip);
    const user = await authenticate(credentials);
    await refundRateLimit(RATE_LIMITS.login, ip);
    const response = dataResponse(user);
    setAuthCookie(response, await signAuthToken(user));
    return response;
  },
  { access: "PUBLIC" },
);
