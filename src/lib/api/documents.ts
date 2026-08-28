import { HttpMethod, apiRoutes } from "@/lib/request";
import { PublicDocument } from "@/lib/types/documents";

const BASE = "/api/care_im_wrapper";

export const documentApi = apiRoutes({
  // Reached by patients who have no CARE account: the token in the path is the whole
  // capability, so this must go out without an Authorization header.
  public_document: {
    path: `${BASE}/public/documents/{token}/`,
    method: HttpMethod.GET,
    TResponse: {} as PublicDocument,
  },
});
