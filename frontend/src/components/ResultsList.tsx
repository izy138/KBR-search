import React from "react";

type ResultItem = {
  id: string;
  title: string;
  snippet?: string;
};

type ResultsListProps = {
  results: ResultItem[];
};

const ResultsList: React.FC<ResultsListProps> = ({ results }) => {
  if (results.length === 0) {
    return <p>No results yet.</p>;
  }

  return (
    <ul>
      {results.map((result) => (
        <li key={result.id}>
          <h4>{result.title}</h4>
          {result.snippet ? <p>{result.snippet}</p> : null}
        </li>
      ))}
    </ul>
  );
};

export default ResultsList;
