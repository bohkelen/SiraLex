import { test } from "vitest";

import { runMatrix } from "./norm_v3_matrix_runner";

/** Opt-in rollout check: cd web && npx vitest run -c vitest.tools.config.ts */
test("norm_v3 featured rollout — three-bundle query matrix", async () => {
  await runMatrix();
}, 120_000);
