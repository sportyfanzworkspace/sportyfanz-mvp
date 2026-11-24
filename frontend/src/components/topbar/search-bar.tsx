"use client";

import { useState } from "react";
import { Search } from "lucide-react";

export default function SearchBar() {
  const [search, setSearch] = useState("");

  return (
    <div className="sf-search">
      <Search size={17} />

      <input
        value={search}
        onChange={(event) =>
          setSearch(event.target.value)
        }
        placeholder="Search teams, players, events..."
      />

      <span className="sf-search-shortcut">
        ⌘ K
      </span>
    </div>
  );
}