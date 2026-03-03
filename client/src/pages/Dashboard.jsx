import { useAuth } from "../context/AuthContext";

const Dashboard = () => {
  const { user, logout } = useAuth();

  return (
    <div className="page">
      <div className="card dashboard">
        <div>
          <h1 className="title">Dashboard</h1>
          <p className="subtitle">You are signed in.</p>
        </div>
        <div className="info">
          <div><strong>Name:</strong> {user?.name}</div>
          <div><strong>Email:</strong> {user?.email}</div>
        </div>
        <button className="button logout" onClick={logout}>
          Log out
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
