import { sql, type SQL } from "drizzle-orm";
import { movies } from "@/database/schemas";

/**
 * Generates a correlated subquery SQL expression to resolve a localized movie title
 * with an automatic fallback language.
 *
 * Avoids boilerplate `leftJoin` and `aliasedTable` declarations across multiple services.
 * Relies on the composite primary key index `(movie_id, language_code)` for O(1) B-tree lookup.
 *
 * @param lang Requested language code (e.g., 'vi', 'en')
 * @param fallback Fallback language code when requested translation is absent (default: 'vi')
 * @returns Strongly-typed SQL expression evaluating to string
 */
export function localizedMovieTitle(lang = "vi", fallback = "vi"): SQL<string> {
  return sql<string>`
    COALESCE(
      (
        SELECT title
        FROM "movie_translations"
        WHERE movie_id = ${movies.id} AND language_code = ${lang}
        LIMIT 1
      ),
      (
        SELECT title
        FROM "movie_translations"
        WHERE movie_id = ${movies.id} AND language_code = ${fallback}
        LIMIT 1
      ),
      ''
    )
  `;
}
