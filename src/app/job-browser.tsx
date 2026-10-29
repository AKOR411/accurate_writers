"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

type Job = {
  title: string;
  category: string;
  employer: string;
  budget: string;
  terms: string;
  posted: string;
  initials: string;
  color: string;
  featured: boolean;
};

const categoryOptions = [
  "All specialties",
  "Blog writing",
  "Copywriting",
  "Research",
  "Social media",
];

export default function JobBrowser({
  jobs,
}: {
  jobs: Job[];
}) {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const initialCategory = searchParams.get("category") ?? categoryOptions[0];
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(
    categoryOptions.find((option) => option === initialCategory) ??
      categoryOptions[0],
  );

  function updateFilters(nextQuery: string, nextCategory: string) {
    setQuery(nextQuery);
    setCategory(nextCategory);

    const params = new URLSearchParams(searchParams.toString());
    if (nextQuery.trim()) {
      params.set("q", nextQuery.trim());
    } else {
      params.delete("q");
    }

    if (nextCategory === categoryOptions[0]) {
      params.delete("category");
    } else {
      params.set("category", nextCategory);
    }

    const queryString = params.toString();
    window.history.replaceState(
      null,
      "",
      queryString ? `/?${queryString}#jobs` : "/#jobs",
    );
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredJobs = jobs.filter((job) => {
    const matchesQuery =
      !normalizedQuery ||
      `${job.title} ${job.category} ${job.employer}`
        .toLowerCase()
        .includes(normalizedQuery);
    const matchesCategory =
      category === "All specialties" || job.category === category;

    return matchesQuery && matchesCategory;
  });

  return (
    <div className="job-browser">
      <form
        className="job-filters"
        onSubmit={(event) => {
          event.preventDefault();
          document
            .getElementById("job-results")
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
      >
        <label className="search-field">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" strokeWidth="1.7" />
            <path d="m16 16 4.2 4.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <span className="visually-hidden">Search opportunities</span>
          <input
            type="search"
            placeholder="Search writing jobs..."
            value={query}
            onChange={(event) => updateFilters(event.target.value, category)}
          />
        </label>
        <label className="category-field">
          <span className="visually-hidden">Filter by specialty</span>
          <select
            value={category}
            onChange={(event) => updateFilters(query, event.target.value)}
          >
            {categoryOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <button className="search-button" type="submit">
          Search <span aria-hidden="true">→</span>
        </button>
      </form>

      <div className="listing-toolbar" id="job-results">
        <p>
          Showing <strong>{filteredJobs.length}</strong>{" "}
          {filteredJobs.length === 1 ? "opportunity" : "opportunities"}
        </p>
        <span>Budget shown in Kenyan shillings</span>
      </div>

      {filteredJobs.length > 0 ? (
        <div className="job-listings">
          {filteredJobs.map((job) => (
            <article className="job-card" key={job.title}>
              <div className={`employer-avatar ${job.color}`} aria-hidden="true">
                {job.initials}
              </div>
              <div className="job-main">
                <div className="job-meta">
                  <span>{job.category}</span>
                  {job.featured && <span className="featured-label">FEATURED</span>}
                </div>
                <h3>{job.title}</h3>
                <p className="job-employer">{job.employer}</p>
                <div className="job-details">
                  <span>{job.terms}</span>
                  <span className="detail-separator">·</span>
                  <span>{job.posted}</span>
                </div>
              </div>
              <div className="job-action">
                <strong>{job.budget}</strong>
                <a href="#join" aria-label={`Learn about ${job.title}`}>
                  View opportunity <span aria-hidden="true">↗</span>
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-results">
          <span className="empty-icon" aria-hidden="true">⌕</span>
          <h3>No opportunities found</h3>
          <p>Try a different search or choose another specialty.</p>
          <button
            className="clear-filters"
            type="button"
            onClick={() => updateFilters("", categoryOptions[0])}
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
