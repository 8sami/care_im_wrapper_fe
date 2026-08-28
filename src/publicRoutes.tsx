import Layout from "@/components/Common/Layout";

import PublicDocumentPage from "./pages/PublicDocument/PublicDocumentPage";

// Routes served to visitors who are not signed in to CARE. Anything added here is world
// readable: the only thing standing between a stranger and the content is the capability
// in the URL, enforced by the plug's own API.
const publicRoutes = {
  "/public/documents/:token": ({ token }: { token: string }) => (
    <Layout>
      <PublicDocumentPage token={token} />
    </Layout>
  ),
};

export default publicRoutes;
