import { register } from "node:module";

// Installs the resolver in ts-resolve.mjs for the rest of the process.
// Used as `node --experimental-strip-types --import ./scripts/lib/register-ts.mjs <test>`.
register("./ts-resolve.mjs", import.meta.url);
