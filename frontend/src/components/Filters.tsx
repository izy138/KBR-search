import React from "react";

type FiltersProps = {
  categories: string[];
  selectedCategory: string;
  onChange: (category: string) => void;
};

const Filters: React.FC<FiltersProps> = ({
  categories,
  selectedCategory,
  onChange,
}) => {
  return (
    <label>
      Category:
      <select
        value={selectedCategory}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All</option>
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
    </label>
  );
};

export default Filters;
