import { Link, Route, Routes } from "react-router-dom";
import "./App.css";

function WelcomePage() {
  return (
    <main className="page">
      <section className="card">
        <p className="badge">Tetra</p>

        <h1>Welcome to Tetra</h1>

        <p className="description">
          A simple client interface for working with the Tetra backend API.
        </p>

        <div className="actions">
          <Link className="primaryButton" to="/register">
            Go to registration
          </Link>
        </div>
      </section>
    </main>
  );
}

function RegisterPage() {
  return (
    <main className="page">
      <section className="card">
        <p className="badge">Registration</p>

        <h1>Create user</h1>

        <p className="description">
          This form will later send the name to the Go backend.
        </p>

        <form className="form">
          <label htmlFor="name">Name</label>

          <input
            id="name"
            name="name"
            type="text"
            placeholder="Enter your name"
          />

          <button type="submit" className="primaryButton">
            Register
          </button>
        </form>

        <Link className="secondaryLink" to="/">
          Back to welcome page
        </Link>
      </section>
    </main>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/register" element={<RegisterPage />} />
    </Routes>
  );
}

export default App;