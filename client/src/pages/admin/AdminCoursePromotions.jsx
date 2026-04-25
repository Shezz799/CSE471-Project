import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  adminCreateCoursePromotion,
  adminDeleteCoursePromotion,
  adminListCoursePromotions,
  adminUpdateCoursePromotion,
} from "../../api/coursePromotions";

const AdminCoursePromotions = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    courseName: "",
    instructorName: "",
    content: "",
    priceBdt: "500",
    priceCredits: "0",
  });
  const [editing, setEditing] = useState(null);
  const [editPrices, setEditPrices] = useState({ priceBdt: "", priceCredits: "" });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionBusy, setActionBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminListCoursePromotions();
      setList(Array.isArray(data?.data) ? data.data : []);
    } catch (e) {
      setMessage(e.response?.data?.message || "Could not load promotions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setSaving(true);
    try {
      const priceBdt = Number(form.priceBdt);
      const priceCredits = Number(form.priceCredits);
      const { data: resBody } = await adminCreateCoursePromotion({
        courseName: form.courseName.trim(),
        instructorName: form.instructorName.trim(),
        content: form.content.trim(),
        priceBdt,
        priceCredits,
      });
      const meta = resBody?.meta || {};
      const nInbox = meta.promotionInboxRowsWritten ?? "—";
      const nUsers = meta.activeUsersTargeted ?? "—";
      const nLive = meta.liveSocketConnections ?? "—";
      setMessage(
        `Promotion created. Inbox rows written: ${nInbox} / ${nUsers} active users. Live socket sends: ${nLive} (tabs open now). Users also pick up new rows within ~30s while the app is open.`
      );
      setForm((f) => ({ ...f, courseName: "", instructorName: "", content: "" }));
      await load();
    } catch (err) {
      setMessage(err.response?.data?.message || "Could not create promotion");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row) => {
    if (!row?.isActive) return;
    setEditing(row);
    setEditPrices({ priceBdt: String(row.priceBdt ?? 0), priceCredits: String(row.priceCredits ?? 0) });
    setMessage("");
  };

  const saveEdit = async () => {
    if (!editing?._id) return;
    setActionBusy("edit");
    setMessage("");
    try {
      await adminUpdateCoursePromotion(editing._id, {
        priceBdt: Number(editPrices.priceBdt),
        priceCredits: Number(editPrices.priceCredits),
      });
      setEditing(null);
      setMessage("Prices updated.");
      await load();
    } catch (e) {
      setMessage(e.response?.data?.message || "Could not update prices");
    } finally {
      setActionBusy("");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget?._id) return;
    setActionBusy("delete");
    setMessage("");
    try {
      await adminDeleteCoursePromotion(deleteTarget._id);
      setDeleteTarget(null);
      setMessage("Promotion removed. Its landing page is no longer public.");
      await load();
    } catch (e) {
      setMessage(e.response?.data?.message || "Could not remove promotion");
    } finally {
      setActionBusy("");
    }
  };

  return (
    <div className="module2-page admin-course-promo-page">
      <header className="module2-page__header">
        <div>
          <h1 className="module2-page__title">Promote external courses</h1>
          <p className="module2-page__subtitle">
            Create a course landing page and notify every active user (saved inbox + live socket). They can pay with
            bKash or credits when prices allow.
          </p>
        </div>
        <Link to="/admin" className="button module2-page__back">
          Admin home
        </Link>
      </header>

      {message ? (
        <p className={message.includes("created") || message.includes("updated") || message.includes("removed") ? "module2-muted" : "error"}>
          {message}
        </p>
      ) : null}

      <section className="card module2-card admin-course-promo-form-card">
        <h2 className="module2-card__title">New promotion</h2>
        <form className="admin-course-promo-form" onSubmit={handleSubmit}>
          <label>
            Course name
            <input
              required
              value={form.courseName}
              onChange={(ev) => setForm((f) => ({ ...f, courseName: ev.target.value }))}
              maxLength={200}
            />
          </label>
          <label>
            Instructor name
            <input
              required
              value={form.instructorName}
              onChange={(ev) => setForm((f) => ({ ...f, instructorName: ev.target.value }))}
              maxLength={200}
            />
          </label>
          <label>
            Course content / description (min. 20 characters)
            <textarea
              required
              rows={8}
              value={form.content}
              onChange={(ev) => setForm((f) => ({ ...f, content: ev.target.value }))}
              maxLength={20000}
            />
          </label>
          <div className="admin-course-promo-form__row">
            <label>
              Price (BDT)
              <input
                type="number"
                min={0}
                step={1}
                value={form.priceBdt}
                onChange={(ev) => setForm((f) => ({ ...f, priceBdt: ev.target.value }))}
              />
            </label>
            <label>
              Price (credits)
              <input
                type="number"
                min={0}
                step={1}
                value={form.priceCredits}
                onChange={(ev) => setForm((f) => ({ ...f, priceCredits: ev.target.value }))}
              />
            </label>
          </div>
          <p className="module2-muted admin-course-promo-form__hint">
            At least one of BDT (৳1+) or credits (1+) is required. Use 0 for an option you do not want to offer.
          </p>
          <button type="submit" className="button" disabled={saving}>
            {saving ? "Sending…" : "Create & notify all users"}
          </button>
        </form>
      </section>

      <section className="card module2-card">
        <h2 className="module2-card__title">Recent promotions</h2>
        {loading ? (
          <p className="module2-muted">Loading…</p>
        ) : list.length === 0 ? (
          <p className="module2-muted">None yet.</p>
        ) : (
          <ul className="admin-course-promo-list">
            {list.map((row) => (
              <li key={row._id} className="admin-course-promo-list__item">
                <div>
                  <strong>{row.courseName}</strong>
                  {!row.isActive ? <span className="error"> (removed)</span> : null}
                  <span className="module2-muted">
                    {" "}
                    · ৳{row.priceBdt} · {row.priceCredits} cr
                  </span>
                </div>
                <div className="admin-course-promo-list__actions">
                  {row.isActive ? (
                    <>
                      <button type="button" className="button button--ghost" onClick={() => openEdit(row)}>
                        Change prices
                      </button>
                      <button type="button" className="button button--ghost" onClick={() => setDeleteTarget(row)}>
                        Remove
                      </button>
                    </>
                  ) : null}
                  {row.isActive ? (
                    <Link className="button button--ghost" to={`/courses/promo/${row._id}`} target="_blank" rel="noreferrer">
                      Open landing
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing ? (
        <>
          <div className="course-promo-modal-overlay" role="presentation" onClick={() => !actionBusy && setEditing(null)} />
          <div className="course-promo-modal" role="dialog" aria-modal="true" aria-label="Update prices">
            <h3>Update prices</h3>
            <p className="module2-muted">{editing.courseName}</p>
            <div className="admin-course-promo-form__row">
              <label>
                BDT
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={editPrices.priceBdt}
                  onChange={(ev) => setEditPrices((p) => ({ ...p, priceBdt: ev.target.value }))}
                />
              </label>
              <label>
                Credits
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={editPrices.priceCredits}
                  onChange={(ev) => setEditPrices((p) => ({ ...p, priceCredits: ev.target.value }))}
                />
              </label>
            </div>
            <div className="course-promo-modal__actions">
              <button type="button" className="button" disabled={Boolean(actionBusy)} onClick={saveEdit}>
                {actionBusy === "edit" ? "Saving…" : "Save prices"}
              </button>
              <button type="button" className="button button--ghost" disabled={Boolean(actionBusy)} onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </div>
        </>
      ) : null}

      {deleteTarget ? (
        <>
          <div className="course-promo-modal-overlay" role="presentation" onClick={() => !actionBusy && setDeleteTarget(null)} />
          <div className="course-promo-modal" role="dialog" aria-modal="true" aria-label="Remove promotion">
            <h3>Remove promotion?</h3>
            <p>
              <strong>{deleteTarget.courseName}</strong> will be hidden from users. Existing enrollments stay on record.
            </p>
            <div className="course-promo-modal__actions">
              <button type="button" className="button" disabled={Boolean(actionBusy)} onClick={confirmDelete}>
                {actionBusy === "delete" ? "Removing…" : "Yes, remove"}
              </button>
              <button
                type="button"
                className="button button--ghost"
                disabled={Boolean(actionBusy)}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default AdminCoursePromotions;
