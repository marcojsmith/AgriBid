import { httpRouter } from "convex/server";

import {
  documentPreflight,
  downloadDocument,
  uploadDocument,
} from "./documentsHttp";

export { addCorsHeaders, getCorsHeaders } from "./lib/cors";

const http = httpRouter();

http.route({
  path: "/documents/upload",
  method: "POST",
  handler: uploadDocument,
});
http.route({
  path: "/documents/upload",
  method: "OPTIONS",
  handler: documentPreflight,
});
http.route({
  path: "/documents/file",
  method: "GET",
  handler: downloadDocument,
});
http.route({
  path: "/documents/file",
  method: "OPTIONS",
  handler: documentPreflight,
});

export default http;
