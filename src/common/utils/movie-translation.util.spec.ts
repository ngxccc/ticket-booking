import { describe, expect, it } from "bun:test";
import { localizedMovieTitle } from "./movie-translation.util";

describe("Movie Translation Utility", () => {
  it("should generate a parameterized SQL expression with requested and fallback languages", () => {
    const expr = localizedMovieTitle("en", "vi");
    expect(expr).toBeDefined();
    // Query chunk checks
    const queryStr = expr.toQuery({
      escapeName: (s) => `"${s}"`,
      escapeParam: (_num, value) => `'${String(value)}'`,
      escapeString: (s) => `'${s}'`,
    });
    expect(queryStr.sql).toContain("COALESCE");
    expect(queryStr.sql).toContain("movie_translations");
    expect(queryStr.sql).toContain("language_code");
    expect(queryStr.params).toContain("en");
    expect(queryStr.params).toContain("vi");
  });

  it("should default both requested and fallback languages to 'vi' if omitted", () => {
    const expr = localizedMovieTitle();
    expect(expr).toBeDefined();
    const queryStr = expr.toQuery({
      escapeName: (s) => `"${s}"`,
      escapeParam: (_num, value) => `'${String(value)}'`,
      escapeString: (s) => `'${s}'`,
    });
    expect(queryStr.params).toEqual(["vi", "vi"]);
  });
});
