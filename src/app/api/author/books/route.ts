import { dataResponse, withApi } from "@/server/http/handler";
import { listBooksForAuthor } from "@/server/services/books";

// The signed-in author's books and totals. authorId comes from the token.
export const GET = withApi(
  async (_request, { user }) =>
    dataResponse(await listBooksForAuthor(user.authorId)),
  { access: "AUTHOR" },
);
