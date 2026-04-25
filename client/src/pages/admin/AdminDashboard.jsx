import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminStats } from "../../api/admin";

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const { data } = await getAdminStats();
        if (!c) setStats(data.data);
      } catch (e) {
        if (!c) setErr(e.response?.data?.message || "Could not load stats");
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const cards = [
    { to: "/admin/complaints", title: "Complaints", desc: "Review tickets, pipeline, notify complainants" },
    { to: "/admin/users", title: "Find users", desc: "Search by name or email, open profiles" },
    { to: "/admin/suspended", title: "Suspended users", desc: "Lift suspension or review appeals" },
    { to: "/admin/banned", title: "Banned users", desc: "Unban or release email for new signup" },
    { to: "/admin/low-ratings", title: "Low mentor ratings", desc: "Users below 2★ average — send coaching email" },
    {
      to: "/admin/course-promotions",
      title: "Course promotions",
      desc: "Publish external courses — notify all users with landing pages and checkout",
    },
  ];

  return (
    <div className="module2-page admin-dashboard-page">
      <header className="module2-page__header">
        <div>
          <h1 className="module2-page__title">Admin dashboard</h1>
          <p className="module2-page__subtitle">
            Moderation, complaints, and user actions. Use the student dashboard for normal activity.
          </p>
        </div>
        <Link to="/dashboard" className="button module2-page__back">
          Back to student dashboard
        </Link>
      </header>

      {err && <p className="error">{err}</p>}

      {stats && (
        <ul className="admin-dashboard-stats">
          <li>
            <strong>{stats.openComplaints}</strong>
            <span>Open / in-progress complaints</span>
          </li>
          <li>
            <strong>{stats.suspendedUsers}</strong>
            <span>Suspended accounts</span>
          </li>
          <li>
            <strong>{stats.bannedUsers}</strong>
            <span>Banned accounts</span>
          </li>
          <li>
            <strong>{stats.appealsPending}</strong>
            <span>Appeal requests pending</span>
          </li>
          <li>
            <strong>৳{Number(stats.platformCreditRevenueBdt ?? 0).toLocaleString()}</strong>
            <span>All-time credit sales (BDT)</span>
          </li>
          <li>
            <strong>৳{Number(stats.platformCreditRevenueLast30dBdt ?? 0).toLocaleString()}</strong>
            <span>Credit sales last 30 days</span>
          </li>
          <li>
            <strong>{stats.platformCreditPurchaseCount ?? 0}</strong>
            <span>Completed credit checkouts</span>
          </li>
        </ul>
      )}

      <div className="admin-dashboard-grid">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="card module2-card admin-dashboard-card">
            <h2 className="module2-card__title">{c.title}</h2>
            <p className="module2-muted">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
