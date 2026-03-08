import { useEffect, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3006";

interface SuggestionsResponse {
  query: string;
  suggestions: string[];
  count: number;
}

interface SearchResultItem {
  id: string;
  label: string;
  category?: string;
  score?: number;
}

/** API returns results as { item: { id, title, category }, score } */
interface ApiSearchResult {
  item: { id: string; title: string; category?: string };
  score: number;
}

interface SearchResponse {
  results: ApiSearchResult[];
  metadata?: { totalResults?: number };
}

const buildUrl = (path: string, params: Record<string, string>): string => {
  const url = new URL(path, API_BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value.trim().length > 0) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
};

const formatScore = (score?: number): string => {
  if (typeof score !== "number") return "—";
  return score.toFixed(3);
};

export default function App(): JSX.Element {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const url = buildUrl("/suggestions", { q: query, limit: "6" });
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Suggestion request failed: ${response.status}`);
        }
        const data = (await response.json()) as SuggestionsResponse;
        setSuggestions(data.suggestions);
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setSuggestions([]);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  const runSearch = async (searchQuery: string): Promise<void> => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return;

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const url = buildUrl("/search", { q: trimmedQuery, limit: "8" });
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Search request failed: ${response.status}`);
      }
      const data = (await response.json()) as SearchResponse;
      const items = (data.results ?? []).map((r) => ({
        id: r.item.id,
        label: r.item.title,
        category: r.item.category,
        score: r.score,
      }));
      setResults(items);
    } catch (error) {
      setResults([]);
      setErrorMessage(error instanceof Error ? error.message : "Search failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void runSearch(query);
  };

  return (
    <div className="page">
      <header className="header">
        <h1>Autocomplete API Demo</h1>
        <p>Type a query to see suggestions and search results.</p>
      </header>

      <form className="search" onSubmit={handleSubmit}>
        <input
          aria-label="Search query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for a topic, framework, or keyword"
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Searching..." : "Search"}
        </button>
      </form>

      {suggestions.length > 0 && (
        <section className="suggestions">
          <h2>Suggestions</h2>
          <div className="pill-list">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="pill"
                onClick={() => {
                  setQuery(suggestion);
                  void runSearch(suggestion);
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="results">
        <h2>Results</h2>
        {errorMessage ? (
          <div className="error">{errorMessage}</div>
        ) : results.length === 0 ? (
          <div className="empty">No results yet. Run a search to populate results.</div>
        ) : (
          <ul>
            {results.map((result) => (
              <li key={result.id}>
                <div className="result-title">{result.label}</div>
                <div className="result-meta">
                  <span>{result.category ?? "General"}</span>
                  <span>Score: {formatScore(result.score)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
