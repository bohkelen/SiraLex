import { describe, expect, it } from "vitest";

import { queryLogHitMiss } from "./query_log_inspect";

describe("queryLogHitMiss", () => {
  it("returns hit when ir_ids_count is positive", () => {
    expect(queryLogHitMiss({ ir_ids_count: 1 })).toBe("hit");
    expect(queryLogHitMiss({ ir_ids_count: 99 })).toBe("hit");
  });

  it("returns miss when ir_ids_count is zero", () => {
    expect(queryLogHitMiss({ ir_ids_count: 0 })).toBe("miss");
  });
});
