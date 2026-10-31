import { createNoteSchema } from "@/lib/schemas/tickets";
import { dataResponse, withApi } from "@/server/http/handler";
import { parseJson } from "@/server/http/request";
import { addInternalNote } from "@/server/services/admin-tickets";

// Add an internal note: visible to the BookLeaf team only.
export const POST = withApi<{ id: string }>(
  async (request, { params, user }) => {
    const input = await parseJson(request, createNoteSchema);
    return dataResponse(await addInternalNote(params.id, input, user.id), 201);
  },
  { access: "ADMIN" },
);
