const fs = require('fs');
let content = fs.readFileSync('app/convex/auctions/queries.ts', 'utf8');

// Conflict 1: Imports
content = content.replace(
/<<<<<<< HEAD\nimport { findUserById } from "\.\.\/users";\n=======\nimport type { Id, Doc } from "\.\.\/_generated\/dataModel";\nimport { getCallerRole, findUserById } from "\.\.\/users";\n>>>>>>> origin\/main/g,
`import type { Id, Doc } from "../_generated/dataModel";
import { findUserById } from "../users";
import { getCallerRole } from "../lib/auth";`
);

fs.writeFileSync('app/convex/auctions/queries.ts', content);
