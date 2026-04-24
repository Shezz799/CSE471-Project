import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getUserAnalytics } from "../api/users";
import { useAuth } from "../context/AuthContext";

const Analytics = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await getUserAnalytics();
        setAnalytics(response.data.data);
      } catch (err) {
        setError("Failed to load analytics data.");
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="layout" style={{ background: "linear-gradient(135deg, #4f46e5 0%, #0f172a 100%)", minHeight: "100vh" }}>
        <main className="feed">
          <div className="loading" style={{ padding: "2rem", textAlign: "center", color: "white" }}>
            Loading your metrics...
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="layout" style={{ background: "linear-gradient(135deg, #4f46e5 0%, #0f172a 100%)", minHeight: "100vh" }}>
        <main className="feed">
          <div className="error" style={{ padding: "2rem", color: "#fca5a5" }}>
            {error}
          </div>
        </main>
      </div>
    );
  }

  const stats = analytics.reviewStats;

  return (
    <div className="layout" style={{ 
      background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)", 
      minHeight: "100vh" 
    }}>
      <main className="feed" style={{ maxWidth: "900px", margin: "0 auto", padding: "2.5rem 1.5rem" }}>
        
        <header style={{ 
          display: "flex", justifyContent: "space-between", alignItems: "center", 
          marginBottom: "3rem",
          background: "linear-gradient(120deg, #1e1b4b, #4338ca)",
          padding: "2rem",
          borderRadius: "16px",
          color: "white",
          boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)"
        }}>
          <div>
            <h1 style={{ fontSize: "2.25rem", fontWeight: "800", marginBottom: "0.25rem", letterSpacing: "-0.025em" }}>Performance Analytics</h1>
            <p style={{ color: "#c7d2fe", fontSize: "1.05rem" }}>A breakdown of your mentoring and learning reputation.</p>
          </div>
          <Link to="/dashboard" style={{
            background: "rgba(255,255,255,0.15)", padding: "0.6rem 1.25rem", borderRadius: "10px",
            textDecoration: "none", color: "white", fontWeight: "600",
            backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.3)",
            transition: "all 0.2s ease"
          }}>
            ← Back to Feed
          </Link>
        </header>

        {/* Quick Stats Grid */}
        <section style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", 
          gap: "1.5rem", 
          marginBottom: "3rem" 
        }}>
          
          {/* Average Rating Item */}
          <div style={{ 
            background: "white", padding: "1.75rem", borderRadius: "16px", 
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
            borderTop: "4px solid #f59e0b"
          }}>
            <h3 style={{ fontSize: "0.85rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "1rem", fontWeight: "700" }}>Average Rating</h3>
            <div style={{ fontSize: "3rem", fontWeight: "900", color: "#1e293b", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {stats.averageRating ? stats.averageRating.toFixed(1) : "—"} 
              <span style={{ fontSize: "1.75rem", color: "#f59e0b" }}>★</span>
            </div>
            <p style={{ fontSize: "0.9rem", color: "#94a3b8", marginTop: "0.5rem" }}>From {stats.reviewCount} total reviews</p>
          </div>

          {/* Offers Made Item */}
          <div style={{ 
            background: "white", padding: "1.75rem", borderRadius: "16px", 
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
            borderTop: "4px solid #10b981"
          }}>
            <h3 style={{ fontSize: "0.85rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "1rem", fontWeight: "700" }}>Offers Made</h3>
            <div style={{ fontSize: "3rem", fontWeight: "900", color: "#1e293b", display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
              {stats.helpsOfferedCount} <span style={{ fontSize: "1.25rem", color: "#10b981", fontWeight: "700" }}>times</span>
            </div>
            <p style={{ fontSize: "0.9rem", color: "#94a3b8", marginTop: "0.5rem" }}>Help offered on posts</p>
          </div>
          
          {/* Current Balance Item */}
          <div style={{ 
            background: "white", padding: "1.75rem", borderRadius: "16px", 
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
            borderTop: "4px solid #4f46e5"
          }}>
            <h3 style={{ fontSize: "0.85rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "1rem", fontWeight: "700" }}>Current Balance</h3>
            <div style={{ fontSize: "3rem", fontWeight: "900", color: "#1e293b", display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
              {analytics.currentCredits} <span style={{ fontSize: "1.25rem", color: "#4f46e5", fontWeight: "700" }}>cr</span>
            </div>
            <p style={{ fontSize: "0.9rem", color: "#94a3b8", marginTop: "0.5rem" }}>Remaining platform currency</p>
          </div>

        </section>

        {/* Split Section: Complaints vs Distribution */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "2rem" }}>
          
          {/* Rating Breakdown */}
          <section>
            <h2 style={{ fontSize: "1.35rem", fontWeight: "800", marginBottom: "1.25rem", color: "#0f172a" }}>Rating Checkup</h2>
            <div style={{ background: "white", borderRadius: "16px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", padding: "2rem" }}>
              {stats.reviewCount === 0 ? (
                <div style={{ textAlign: "center", color: "#94a3b8", padding: "2rem 0" }}>
                  Offer help to earn your first rating!
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  {[5, 4, 3, 2, 1].map(stars => {
                    const count = stats.distribution?.[stars] || 0;
                    const percentage = stats.reviewCount > 0 ? Math.round((count / stats.reviewCount) * 100) : 0;
                    
                    return (
                      <div key={stars} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <div style={{ width: "50px", fontWeight: "700", color: "#334155", fontSize: "0.95rem" }}>{stars} Star</div>
                        <div style={{ flex: 1, background: "#f1f5f9", height: "12px", borderRadius: "99px", overflow: "hidden" }}>
                          <div style={{ 
                            background: stars > 3 ? "linear-gradient(90deg, #10b981, #34d399)" : stars === 3 ? "linear-gradient(90deg, #f59e0b, #fbbf24)" : "linear-gradient(90deg, #ef4444, #f87171)", 
                            height: "100%", 
                            width: `${percentage}%`,
                            borderRadius: "99px",
                            transition: "width 1s ease"
                          }}></div>
                        </div>
                        <div style={{ width: "45px", textAlign: "right", color: "#64748b", fontSize: "0.9rem", fontWeight: "600" }}>{percentage}%</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Trust & Safety Complaints Box */}
          <section>
            <h2 style={{ fontSize: "1.35rem", fontWeight: "800", marginBottom: "1.25rem", color: "#0f172a" }}>Trust &amp; Safety</h2>
            <div style={{ background: "white", borderRadius: "16px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              
              <div style={{ 
                background: analytics.complaintsAgainstYou > 0 ? "#fef2f2" : "#ecfdf5", 
                border: `1px solid ${analytics.complaintsAgainstYou > 0 ? "#fecaca" : "#a7f3d0"}`,
                padding: "1.5rem", borderRadius: "12px"
              }}>
                <div style={{ color: analytics.complaintsAgainstYou > 0 ? "#b91c1c" : "#047857", fontWeight: "800", fontSize: "1.1rem", marginBottom: "0.25rem" }}>
                  Complaints Against You
                </div>
                <div style={{ fontSize: "2rem", fontWeight: "900", color: analytics.complaintsAgainstYou > 0 ? "#ef4444" : "#10b981" }}>
                  {analytics.complaintsAgainstYou}
                </div>
                <p style={{ fontSize: "0.85rem", color: analytics.complaintsAgainstYou > 0 ? "#dc2626" : "#059669", marginTop: "0.25rem" }}>
                  {analytics.complaintsAgainstYou === 0 ? "You have a flawless record!" : "Please review community guidelines."}
                </p>
              </div>

              <div style={{ 
                background: "#f8fafc", 
                border: "1px solid #e2e8f0",
                padding: "1.5rem", borderRadius: "12px"
              }}>
                <div style={{ color: "#475569", fontWeight: "800", fontSize: "1.1rem", marginBottom: "0.25rem" }}>
                  Complaints Filed By You
                </div>
                <div style={{ fontSize: "2rem", fontWeight: "900", color: "#334155" }}>
                  {analytics.complaintsFiledByYou}
                </div>
                <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.25rem" }}>
                  Reports you submitted to admins.
                </p>
              </div>

            </div>
          </section>

        </div>
        
      </main>
    </div>
  );
};

export default Analytics;
