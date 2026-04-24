import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listCourseCatalog } from "../api/coursePromotions";

const CourseCatalogPage = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(search.trim()), 320);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await listCourseCatalog(debouncedQ ? { q: debouncedQ } : {});
        if (!cancelled) setCourses(Array.isArray(data?.data) ? data.data : []);
      } catch (e) {
        if (!cancelled) {
          setError(e.response?.data?.message || "Could not load courses");
          setCourses([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedQ]);

  return (
    <div className="module2-page course-catalog-page">
      <header className="module2-page__header">
        <div>
          <h1 className="module2-page__title">Promoted courses</h1>
          <p className="module2-page__subtitle">
            External courses from admins. Search by title, instructor, or keywords in the description.
          </p>
        </div>
        <Link to="/dashboard" className="button module2-page__back">
          Back to dashboard
        </Link>
      </header>

      <section className="card module2-card course-catalog-page__panel">
        <label className="course-catalog-page__search-label" htmlFor="course-catalog-search">
          Search
        </label>
        <input
          id="course-catalog-search"
          className="course-catalog-page__search"
          type="search"
          placeholder="Search keywords…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />

        {loading ? <p className="module2-muted course-catalog-page__status">Loading…</p> : null}
        {error ? <p className="error course-catalog-page__status">{error}</p> : null}
        {!loading && !error && courses.length === 0 ? (
          <p className="module2-muted course-catalog-page__status">
            {debouncedQ ? "No courses match those keywords." : "No promoted courses yet."}
          </p>
        ) : null}

        {!loading && !error && courses.length > 0 ? (
          <ul className="course-catalog-page__grid">
            {courses.map((c) => (
              <li key={c._id} className="course-catalog-page__card">
                <Link to={`/courses/promo/${c._id}`} className="course-catalog-page__card-link">
                  <span className="course-catalog-page__card-title">{c.courseName}</span>
                  <span className="course-catalog-page__card-instructor">{c.instructorName}</span>
                  <span className="course-catalog-page__card-excerpt">{c.excerpt}</span>
                  <span className="course-catalog-page__card-prices">
                    {Number(c.priceBdt) >= 1 ? `৳${c.priceBdt}` : ""}
                    {Number(c.priceBdt) >= 1 && Number(c.priceCredits) >= 1 ? " · " : ""}
                    {Number(c.priceCredits) >= 1 ? `${c.priceCredits} credits` : ""}
                    {Number(c.priceBdt) < 1 && Number(c.priceCredits) < 1 ? "See page for pricing" : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
};

export default CourseCatalogPage;
