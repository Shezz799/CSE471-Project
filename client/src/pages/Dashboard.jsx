import { useAuth } from "../context/AuthContext";

const Dashboard = () => {
  const { logout } = useAuth();

  return (
    <div className="page">
      <div className="card dashboard">
        <div>
          <h1 className="title">Dashboard</h1>
          <p className="subtitle">comin soon</p>
        </div>
        <button className="button logout" onClick={logout}>
          Log out
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
