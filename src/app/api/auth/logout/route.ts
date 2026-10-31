import { clearAuthCookie } from "@/server/auth/cookie";
import { dataResponse, withApi } from "@/server/http/handler";

// Clears the session cookie. The token itself stays valid until it expires
// (stateless JWT, architecture §5).
export const POST = withApi(
  () => {
    const response = dataResponse({ loggedOut: true });
    clearAuthCookie(response);
    return response;
  },
  { access: "AUTHENTICATED" },
);
