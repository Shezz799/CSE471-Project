import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listSuspendedUsers, unsuspendUser } from "../../api/admin";

const AdminSuspended = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await listSuspendedUsers();
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

  const lift = async (id) => {
    if (!window.confirm("Lift suspension? User will be emailed.")) return;
    try {
      await unsuspendUser(id);
      await load();
    } catch (e) {
      alert(e.response?.data?.message || "Failed");
    }
  };

  return (
    <div className="module2-page">
      <header className="module2-page__header">
        <div>
          <h1 className="module2-page__title">Suspended users</h1>
          <p className="module2-page__subtitle">Restore access or open a profile.</p>
        </div>
        <Link to="/admin" className="button module2-page__back">
          Admin home
        </Link>
      </header>

      {loading ? (
        <p className="module2-muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="module2-muted">No suspended users.</p>
      ) : (
        <ul className="module2-list">
          {list.map((u) => (
            <li key={u._id} className="module2-list-item">
              <div>
                <strong>{u.name}</strong> · {u.email}
                {u.appealPending ? (
                  <span className="module2-badge module2-badge--open"> Appeal pending</span>
                ) : null}
              </div>
              {u.moderationReason ? (
                <p className="module2-muted">Reason: {u.moderationReason}</p>
              ) : null}
              {u.appealMessage ? (
                <p className="module2-review-text">
                  <em>Appeal:</em> {u.appealMessage}
                </p>
              ) : null}
              <div className="skill-dashboard__modal-actions">
                <Link to={`/profile/${u._id}`} className="button button--ghost">
                  Profile
                </Link>
                <button type="button" className="button" onClick={() => lift(u._id)}>
                  Unsuspend
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminSuspended;
