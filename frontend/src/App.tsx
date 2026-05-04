import { useMemo, useState } from "react";
import Charts from "./components/Charts";
import Filters from "./components/Filters";
import ResultsList from "./components/ResultsList";
import SearchBar from "./components/SearchBar";
import {
  type AnalyticsCategory,
  type SearchResultRecord,
  getAnalyticsSummary,
  searchProjects,
} from "./api";

export default function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultRecord[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [chartData, setChartData] = useState<AnalyticsCategory[]>([]);

  const categories = useMemo(() => {
    const source = chartData.length ? chartData : [];
    return source.map((point) => point.label);
  }, [chartData]);

  const loadAnalytics = async () => {
    const payload = await getAnalyticsSummary();
    setChartData(payload.by_category);
  };

  const runSearch = async (nextQuery: string) => {
    setQuery(nextQuery);
    const payload = await searchProjects(nextQuery, 25);
    setResults(payload.results);
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
