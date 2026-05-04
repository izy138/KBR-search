import { useMemo, useState } from "react";
import Charts from "./components/Charts";
import Filters from "./components/Filters";
import ResultsList from "./components/ResultsList";
import SearchBar from "./components/SearchBar";

type SearchResult = {
  _id?: string;
  id?: string;
  title?: string;
  project_title?: string;
  abstract?: string;
  category?: string;
  [key: string]: unknown;
};

type AnalyticsPoint = {
  label: string;
  value: number;
};

const API_BASE_URL = "http://localhost:8000";

export default function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [chartData, setChartData] = useState<AnalyticsPoint[]>([]);

  const categories = useMemo(() => {
    const source = chartData.length ? chartData : [];
    return source.map((point) => point.label);
  }, [chartData]);

  const loadAnalytics = async () => {
    const response = await fetch(`${API_BASE_URL}/analytics/summary`);
    const payload = await response.json();
    setChartData(payload.by_category ?? []);
  };

  const runSearch = async (nextQuery: string) => {
    setQuery(nextQuery);
    const url = new URL(`${API_BASE_URL}/search/`);
    url.searchParams.set("q", nextQuery);
    url.searchParams.set("limit", "25");

    const response = await fetch(url);
    const payload = await response.json();
    setResults(payload.results ?? []);
  };

  const visibleResults = useMemo(() => {
    if (!selectedCategory) {
      return results;
    }
    return results.filter((item) => {
      const category = typeof item.category === "string" ? item.category : "";
      return category === selectedCategory;
    });
  }, [results, selectedCategory]);

  return (
    <main className="container">
      <h1>KBR Internship Search</h1>
      <SearchBar onSearch={runSearch} />
      <button onClick={loadAnalytics} type="button">
        Load Analytics
      </button>
      <Filters
        categories={categories}
        selectedCategory={selectedCategory}
        onChange={setSelectedCategory}
      />
      <Charts data={chartData} />
      <h2>Results for: {query || "all records"}</h2>
      <ResultsList
        results={visibleResults.map((item, index) => ({
          id: item._id ?? item.id ?? String(index),
          title:
            typeof item.title === "string"
              ? item.title
              : typeof item.project_title === "string"
                ? item.project_title
                : "Untitled",
          snippet:
            typeof item.abstract === "string"
              ? item.abstract.slice(0, 200)
              : "No abstract available",
        }))}
      />
    </main>
  );
}
