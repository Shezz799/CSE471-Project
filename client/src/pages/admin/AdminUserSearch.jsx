import { useState } from "react";
import { Link } from "react-router-dom";
import { searchAdminUsers } from "../../api/admin";

const AdminUserSearch = () => {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const search = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const { data } = await searchAdminUsers(q.trim());
      setResults(data.data || []);
    } catch (ex) {
      setErr(ex.response?.data?.message || "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="module2-page">
      <header className="module2-page__header">
        <div>
          <h1 className="module2-page__title">Find users</h1>
          <p className="module2-page__subtitle">Search by name or email, then open their profile for moderation.</p>
        </div>
        <Link to="/admin" className="button module2-page__back">
          Admin home
        </Link>
      </header>

      <form className="card module2-card module2-form" onSubmit={search}>
        <div className="field">
          <label className="label" htmlFor="adm-search">
            Query
          </label>
          <input
            id="adm-search"
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name or email fragment"
            minLength={2}
          />
        </div>
        {err && <p className="error">{err}</p>}
        <button type="submit" className="button" disabled={loading || q.trim().length < 2}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {results.length > 0 && (
        <ul className="module2-list" style={{ marginTop: "1rem" }}>
          {results.map((u) => (
            <li key={u.id} className="module2-list-item">
              <Link to={`/profile/${u.id}`}>
                <strong>{u.name}</strong>
              </Link>{" "}
              · {u.email}
              {u.accountStatus && u.accountStatus !== "active" ? (
                <span className="module2-muted"> · {u.accountStatus}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminUserSearch;
