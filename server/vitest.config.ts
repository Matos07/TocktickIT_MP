// import { defineConfig } from "vitest/config";

// export default defineConfig({
//   test: {
//     environment: "node",
//     include: ["tests/**/*.test.ts"],
//   },
// });

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false, // shared dev DB — avoid cross-file race conditions (e.g. AC-04 ticket-count assertions)
  },
});