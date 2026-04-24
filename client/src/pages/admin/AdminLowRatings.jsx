import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listLowRatedUsers, sendCoachEmail } from "../../api/admin";

const AdminLowRatings = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [custom, setCustom] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await listLowRatedUsers({ below: 2, minReviews: 2 });
      setList(data.data || []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const send = async (id) => {
    try {
      await sendCoachEmail(id, custom[id] || "");
      alert("Email sent (or logged if SMTP is not configured).");
    } catch (e) {
      alert(e.response?.data?.message || "Failed");
    }
  };

  return (
    <div className="module2-page">
      <header className="module2-page__header">
        <div>
          <h1 className="module2-page__title">Low mentor ratings</h1>
          <p className="module2-page__subtitle">
            Mentors with average rating below 2 and at least 2 reviews. Send a polite coaching email.
          </p>
        </div>
        <Link to="/admin" className="button module2-page__back">
          Admin home
        </Link>
      </header>

      {loading ? (
        <p className="module2-muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="module2-muted">No users match this rule right now.</p>
      ) : (
        <ul className="module2-list">
          {list.map((u) => (
            <li key={u.id} className="module2-list-item">
              <div>
                <Link to={`/profile/${u.id}`}>
                  <strong>{u.name}</strong>
                </Link>{" "}
                · {u.email} · <strong>{u.averageRating}★</strong> ({u.reviewCount} reviews)
              </div>
              <div className="field" style={{ marginTop: "0.5rem" }}>
                <label className="label">Optional custom paragraph</label>
                <textarea
                  className="input"
                  rows={2}
                  value={custom[u.id] || ""}
                  onChange={(e) => setCustom((prev) => ({ ...prev, [u.id]: e.target.value }))}
                  placeholder="Leave blank for default template"
                />
              </div>
              <button type="button" className="button" style={{ marginTop: "0.5rem" }} onClick={() => send(u.id)}>
                Send coaching email
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminLowRatings;
