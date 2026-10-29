import { Suspense } from "react";
import JobBrowser from "./job-browser";

const jobs = [
  {
    title: "SEO blog writer for a travel brand",
    category: "Blog writing",
    employer: "Savanna Digital",
    budget: "KSh 4,000–6,000",
    terms: "Per article · 1,200 words",
    posted: "2 hours ago",
    initials: "SD",
    color: "lavender",
    featured: true,
  },
  {
    title: "Product descriptions for an online store",
    category: "Copywriting",
    employer: "Maji Home",
    budget: "KSh 12,000",
    terms: "Fixed price · 20 products",
    posted: "5 hours ago",
    initials: "MH",
    color: "mint",
    featured: false,
  },
  {
    title: "Research assistant for a business report",
    category: "Research",
    employer: "Northstar Consulting",
    budget: "KSh 1,500–2,000",
    terms: "Per page · 10 pages",
    posted: "Yesterday",
    initials: "NC",
    color: "peach",
    featured: false,
  },
  {
    title: "Social media captions for a new launch",
    category: "Social media",
    employer: "Kipepeo Beauty",
    budget: "KSh 7,500",
    terms: "Fixed price · 15 captions",
    posted: "Yesterday",
    initials: "KB",
    color: "blue",
    featured: false,
  },
];

const steps = [
  {
    number: "01",
    title: "Create an account",
    text: "Set up a profile as a writer or an employer in just a few steps.",
  },
  {
    number: "02",
    title: "Browse opportunities",
    text: "Explore writing projects or discover writers who fit your needs.",
  },
  {
    number: "03",
    title: "Get matched",
    text: "Connect with the right people and agree on a project together.",
  },
  {
    number: "04",
    title: "Get to work",
    text: "Bring your ideas to life and build relationships through great work.",
  },
];

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path
          d="M19.9 5.2 26.8 12 13 25.8l-8.3 2.1 2.1-8.3L19.9 5.2Z"
          fill="currentColor"
        />
        <path d="m17.5 7.6 6.9 6.9" stroke="white" strokeWidth="2" />
        <path d="m5 28 8.3-2.1L5 28Z" fill="#F6AA48" />
      </svg>
    </span>
  );
}

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#" aria-label="Accurate Writers home">
            <BrandMark />
            <span>Accurate Writers</span>
          </a>
          <nav className="main-nav" aria-label="Main navigation">
            <a href="#">
              Home
            </a>
            <a className="nav-active" href="#jobs">Find jobs</a>
            <a href="#for-employers">For employers</a>
            <a href="#for-writers">For writers</a>
            <a href="#about">About</a>
          </nav>
          <div className="header-actions">
            <a className="login-link" href="/register?mode=login">
              Log in
            </a>
            <a className="button button-small" href="/register">
              Sign up <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              A home for writers and great ideas
            </div>
            <h1 id="hero-title">
              Professional writing.
              <br />
              <span>Real opportunities.</span>
            </h1>
            <p className="hero-description">
              Connect with skilled writers or find quality writing jobs.
              Accurate Writers is the trusted platform for freelance writers
              and employers.
            </p>
            <form className="hero-search" action="/#jobs" method="get">
              <label className="hero-category">
                <span className="visually-hidden">Select a writing specialty</span>
                <select name="category" defaultValue="All specialties">
                  <option>All specialties</option>
                  <option>Blog writing</option>
                  <option>Copywriting</option>
                  <option>Research</option>
                  <option>Social media</option>
                </select>
              </label>
              <label className="hero-query">
                <span className="visually-hidden">Search writing jobs</span>
                <input
                  type="search"
                  name="q"
                  placeholder="Search writing jobs, blog posts, articles..."
                />
              </label>
              <button className="hero-search-button" type="submit">
                Search
              </button>
            </form>
            <a className="hero-employer-link" href="/register?role=employer">
              Hiring a writer? <span>Find the right talent <span aria-hidden="true">↗</span></span>
            </a>
          </div>
          <div className="hero-image-caption" aria-hidden="true">
            <span /> Make your next words count
          </div>
        </div>
        <div className="hero-bottom">
          <div className="hero-bottom-inner">
            <span className="trust-intro">A better way to work together</span>
            <div className="hero-benefits">
              <span><i>✓</i> Opportunities for every specialty</span>
              <span><i>✓</i> Clear project expectations</span>
              <span><i>✓</i> A community built on good work</span>
            </div>
          </div>
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <div className="section-wrap how-inner">
          <div className="how-intro">
            <p className="section-kicker">HOW IT WORKS</p>
            <h2>Good work starts with a good connection.</h2>
            <p>
              Whether you write or hire, finding the right fit should feel
              simple.
            </p>
            <a className="button" href="/register">
              Get started <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className="steps">
            {steps.map((step) => (
              <article className="step-card" key={step.number}>
                <span className="step-number">{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
                <span className="step-arrow" aria-hidden="true">↗</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="jobs-section section-wrap" id="jobs">
        <div className="section-heading">
          <div>
            <p className="section-kicker">THE LATEST OPPORTUNITIES</p>
            <h2>Find work that fits your words.</h2>
            <p className="section-subtitle">
              Explore writing projects from clients looking for your skills.
            </p>
          </div>
          <a className="text-link" href="/register?role=writer">
            Browse all opportunities <span aria-hidden="true">↗</span>
          </a>
        </div>
        <Suspense fallback={<div className="job-browser-loading" />}>
          <JobBrowser jobs={jobs} />
        </Suspense>
        <p className="sample-note">
          <span aria-hidden="true">ⓘ</span> Example listings shown for preview.
        </p>
      </section>

      <section className="audience-section section-wrap" id="about">
        <div className="audience-heading">
          <p className="section-kicker">MADE FOR BOTH SIDES</p>
          <h2>Good work happens together.</h2>
        </div>
        <div className="audience-grid">
          <article className="audience-card writer-card" id="for-writers">
            <div className="audience-icon writer-icon" aria-hidden="true">✎</div>
            <p className="audience-label">FOR WRITERS</p>
            <h3>Make your next move a good one.</h3>
            <p>
              Find projects that respect your craft, your time, and your
              ambitions.
            </p>
            <a href="#jobs" className="text-link">
              Explore writing work <span aria-hidden="true">↗</span>
            </a>
          </article>
          <article className="audience-card employer-card" id="for-employers">
            <div className="audience-icon employer-icon" aria-hidden="true">✦</div>
            <p className="audience-label">FOR EMPLOYERS</p>
            <h3>Find the words to move you forward.</h3>
            <p>
              Meet talented writers ready to bring fresh thinking to your
              next project.
            </p>
            <a href="/register?role=employer" className="text-link">
              Find a writer <span aria-hidden="true">↗</span>
            </a>
          </article>
        </div>
      </section>

      <section className="join-section" id="join">
        <div className="join-inner">
          <div>
            <p className="section-kicker">YOUR NEXT CHAPTER STARTS HERE</p>
            <h2>Let&apos;s make good work happen.</h2>
            <p>Join Accurate Writers and find your place in the story.</p>
          </div>
          <a className="button button-light" href="/register">
            Join Accurate Writers <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-inner">
          <a className="brand footer-brand" href="#" aria-label="Accurate Writers home">
            <BrandMark />
            <span>Accurate Writers</span>
          </a>
          <p>Better writing. Better opportunities.</p>
          <span className="copyright">© Accurate Writers</span>
        </div>
      </footer>
    </main>
  );
}
