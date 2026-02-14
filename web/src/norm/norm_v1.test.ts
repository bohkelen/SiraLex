import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { computeSearchKeys, RULESET_ID } from "./norm_v1";

type Fixture = {
  ruleset_id: string;
  cases: Array<{
    input: string;
    input_nfc: string;
    expected: Record<string, string[]>;
    normalized_record_projection: {
      preferred_form: string;
      variant_forms: string[];
      search_keys: Record<string, string[]>;
    };
  }>;
};

function loadFixture(): Fixture {
  const fixturePath = path.resolve(
    process.cwd(),
    "..",
    "shared",
    "normalization",
    "fixtures",
    "norm_v1_search_keys.json",
  );
  const txt = fs.readFileSync(fixturePath, "utf-8");
  return JSON.parse(txt) as Fixture;
}

describe("norm_v1 JS mirror parity", () => {
  it("matches the shared Python-generated fixture", () => {
    const fixture = loadFixture();
    expect(fixture.ruleset_id).toBe(RULESET_ID);

    for (const c of fixture.cases) {
      const got = computeSearchKeys([c.input_nfc]);
      expect(got).toEqual(c.expected);

      // Projection behavior: preferred + variants + keys
      expect(c.normalized_record_projection.preferred_form).toBe(c.input_nfc);
      expect(c.normalized_record_projection.variant_forms).toEqual([c.input_nfc]);
      expect(c.normalized_record_projection.search_keys).toEqual(c.expected);
    }
  });
});

