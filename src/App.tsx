import { useState, type FormEvent } from "react";
import { Link, Route, Routes } from "react-router-dom";
import "./App.css";

type AddUserResponse = {
  status: string;
  message: string;
};

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
  const [name, setName] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setResultMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("http://127.0.0.1:8080/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name,
        }),
      });

      const data: AddUserResponse = await response.json();

      if (!response.ok) {
        setErrorMessage(data.message);
        return;
      }

      setResultMessage(data.message);
    } catch {
      setErrorMessage("Backend is not available");
    }
  }

  return (
    <main className="page">
      <section className="card">
        <p className="badge">Registration</p>

        <h1>Create user</h1>

        <p className="description">
          Enter a name and send it to the Go backend.
        </p>

        <form className="form" onSubmit={handleSubmit}>
          <label htmlFor="name">Name</label>

          <input
            id="name"
            name="name"
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />

          <button type="submit" className="primaryButton">
            Register
          </button>
        </form>

        {resultMessage && (
          <p className="successMessage">Result: {resultMessage}</p>
        )}

        {errorMessage && (
          <p className="errorMessage">Error: {errorMessage}</p>
        )}

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