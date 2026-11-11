/**
 * Dashboard page shown after login.
 * For now it only welcomes the user. Each role's features are added in later use cases.
 */
function Dashboard({ user }) {
  return (
    <div className="card">
      <h2>Welcome, {user.fullName}</h2>
      <p>You are logged in as: {user.role}</p>
    </div>
  );
}

export default Dashboard;
