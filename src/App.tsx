import { useEffect, useState, type FormEvent } from "react";
import { Link, Route, Routes, useNavigate } from "react-router-dom";
import "./App.css";

type ApiMessageResponse = {
  status?: string;
  message?: string;
};

type AuthResponse = ApiMessageResponse & {
  accessToken?: string;
  access_token?: string;
  token?: string;
  jwt?: string;
  refreshToken?: string;
  refresh_token?: string;
};

type CurrentUserResponse = {
  id?: string | number;
  email?: string;
  name?: string;
  created_at?: string;
};

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";

function getAccessToken(data: AuthResponse) {
  return data.accessToken ?? data.access_token ?? data.token ?? data.jwt;
}

function getRefreshToken(data: AuthResponse) {
  return data.refreshToken ?? data.refresh_token;
}

function saveTokens(data: AuthResponse) {
  const accessToken = getAccessToken(data);
  const refreshToken = getRefreshToken(data);

  if (!accessToken || !refreshToken) {
    throw new Error("Backend did not return tokens");
  }

  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function hasSavedAccessToken() {
  return Boolean(localStorage.getItem(ACCESS_TOKEN_KEY));
}

async function refreshTokens() {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

  if (!refreshToken) {
    throw new Error("Refresh token is missing");
  }

  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const data = await readResponse<AuthResponse>(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "Не удалось обновить сессию"));
  }

  saveTokens(data);

  const accessToken = getAccessToken(data);

  if (!accessToken) {
    throw new Error("Backend did not return access token");
  }

  return accessToken;
}

async function fetchProfile(accessToken: string) {
  const response = await fetch("/api/api/profile", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await readResponse<CurrentUserResponse & ApiMessageResponse>(response);

  return { response, data };
}

async function fetchProfileWithRefresh() {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);

  if (!accessToken) {
    throw new Error("Access token is missing");
  }

  const firstAttempt = await fetchProfile(accessToken);

  if (firstAttempt.response.status !== 401) {
    return firstAttempt;
  }

  const newAccessToken = await refreshTokens();

  return fetchProfile(newAccessToken);
}

async function readResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return { message: text } as T;
  }
}

function getErrorMessage(data: ApiMessageResponse, fallback: string) {
  return data.message || fallback;
}

function formatProfileDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function WelcomePage() {
  const isAuthenticated = hasSavedAccessToken();

  return (
    <main className="landingPage">
      <header className="topBar">
        <Link className="brand" to="/">
          <span className="brandMark">T</span>
          <span>Tetra</span>
        </Link>

        <nav className="topNav">
          <a href="#mess">Проблема</a>
          <a href="#how">Как работает</a>
          {isAuthenticated ? (
            <Link className="profileNavLink" to="/profile">
              Профиль
            </Link>
          ) : (
            <>
              <Link to="/register">Регистрация</Link>
              <Link to="/login">Войти</Link>
            </>
          )}
        </nav>
      </header>

      <section className="hero">
        <div className="heroCopy">
          <p className="eyebrow">личное облако с AI-классификацией</p>

          <h1>Файлы больше не нужно помнить</h1>

          <p className="lead">
            Tetra — это облако для людей, у которых документы, чеки, договоры,
            сканы и фото живут своей жизнью. Загружайте всё как есть, а Tetra
            сама поймёт, что это, и найдёт нужное по человеческому вопросу.
          </p>

          <div className="heroActions">
            <Link className="primaryButton" to={isAuthenticated ? "/profile" : "/register"}>
              {isAuthenticated ? "Открыть профиль" : "Создать аккаунт"}
            </Link>

            {isAuthenticated ? (
              <Link className="ghostButton" to="/profile">
                Мой аккаунт
              </Link>
            ) : (
              <Link className="ghostButton" to="/login">
                Войти
              </Link>
            )}
          </div>
        </div>

        <div className="chaosDesk" aria-label="Digital file chaos">
          <div className="fileCard fileA">
            <span>PDF</span>
            договор_финал_точно.pdf
          </div>
          <div className="fileCard fileB">
            <span>JPG</span>
            IMG_4481.jpg
          </div>
          <div className="fileCard fileC">
            <span>DOCX</span>
            новый_документ_2.docx
          </div>
          <div className="fileCard fileD">
            <span>PNG</span>
            чек_без_названия.png
          </div>
          <div className="fileCard fileE">
            <span>PDF</span>
            scan_001.pdf
          </div>

          <div className="tetraAnswer">
            <p className="answerLabel">Tetra нашла</p>
            <h2>Договор с СантехПромТорг</h2>
            <p>
              PDF · загружен 12 марта · категория: договор поставки · найден по
              содержимому, не по имени файла.
            </p>
          </div>
        </div>
      </section>

      <section className="messSection" id="mess">
        <div className="sectionIntro">
          <p className="eyebrow">без Tetra</p>
          <h2>Обычное облако хранит файлы. Но не понимает их.</h2>
        </div>

        <div className="beforeAfter">
          <div className="messBox">
            <h3>До</h3>
            <ul>
              <li>Downloads/Новая папка/Новая папка (3)</li>
              <li>scan_final_final.pdf</li>
              <li>IMG_20260521_184422.jpg</li>
              <li>чек.jpg</li>
              <li>договор новый итог 2.pdf</li>
            </ul>
          </div>

          <div className="orderBox">
            <h3>После</h3>
            <ul>
              <li>Чеки за апрель — 14 файлов</li>
              <li>Договоры поставки — 3 файла</li>
              <li>Гарантии на технику — 6 файлов</li>
              <li>Банковские выписки — 8 файлов</li>
              <li>Документы по квартире — 11 файлов</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="askSection" id="how">
        <div className="assistantPanel">
          <div className="message userMessage">
            Где у меня все чеки за апрель?
          </div>
          <div className="message tetraMessage">
            Нашла 14 чеков. Больше всего: продукты, аптеки и доставка.
          </div>
          <div className="message userMessage">
            А куда я дел гарантию на монитор?
          </div>
          <div className="message tetraMessage">
            Гарантия найдена. Файл называется IMG_4481.jpg, но внутри указан
            монитор BenQ и дата покупки.
          </div>
        </div>

        <div className="askCopy">
          <p className="eyebrow">спросите как человека</p>
          <h2>Не ищите по имени файла. Просто спросите.</h2>
          <p>
            Tetra анализирует содержимое, вытаскивает смысл и превращает
            файловую помойку в понятную личную базу документов.
          </p>
        </div>
      </section>
    </main>
  );
}

function AuthPage({ mode }: { mode: "register" | "login" }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch(isRegister ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await readResponse<AuthResponse>(response);

      if (!response.ok) {
        setErrorMessage(
          getErrorMessage(
            data,
            isRegister ? "Не удалось зарегистрироваться" : "Не удалось войти",
          ),
        );
        return;
      }

      saveTokens(data);
      navigate("/profile");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Backend is not available",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="registerPage">
      <section className="registerCard">
        <p className="eyebrow">{isRegister ? "регистрация" : "вход"}</p>

        <h1>{isRegister ? "Создать аккаунт" : "Войти в Tetra"}</h1>

        <p className="registerDescription">
          {isRegister
            ? "Введите email и пароль, чтобы создать аккаунт и перейти в личный профиль Tetra."
            : "Введите email и пароль, чтобы войти в личный профиль Tetra."}
        </p>

        <form className="form" onSubmit={handleSubmit}>
          <label htmlFor={`${mode}-email`}>Email</label>
          <input
            id={`${mode}-email`}
            name="email"
            type="email"
            placeholder="sasha@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor={`${mode}-password`}>Пароль</label>
          <input
            id={`${mode}-password`}
            name="password"
            type="password"
            placeholder="Минимум 6 символов"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={isRegister ? "new-password" : "current-password"}
            minLength={6}
            required
          />

          <button type="submit" className="primaryButton" disabled={isSubmitting}>
            {isSubmitting
              ? "Проверяем..."
              : isRegister
                ? "Зарегистрироваться"
                : "Войти"}
          </button>
        </form>

        {errorMessage && <p className="errorMessage">Ошибка: {errorMessage}</p>}

        <div className="authLinks">
          <Link className="backLink" to={isRegister ? "/login" : "/register"}>
            {isRegister ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
          </Link>
        </div>
      </section>
    </main>
  );
}

function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUserResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);

    if (!accessToken) {
      navigate("/login");
      return;
    }

    async function loadProfile() {
      try {
        const { response, data } = await fetchProfileWithRefresh();

        if (!response.ok) {
          setErrorMessage(getErrorMessage(data, "Не удалось загрузить профиль"));
          return;
        }

        setUser(data);
      } catch (error) {
        clearTokens();
        setErrorMessage(
          error instanceof Error ? error.message : "Backend is not available",
        );
        navigate("/login");
      } finally {
        setIsLoading(false);
      }
    }

    void loadProfile();
  }, [navigate]);

  function handleLogout() {
    clearTokens();
    navigate("/login");
  }

  const profileInitial = user?.email?.trim().charAt(0).toUpperCase() ?? "T";

  return (
    <main className="registerPage">
      <section className="registerCard profileCard">
        <p className="eyebrow">профиль</p>

        <div className="profileHeader">
          <div className="profileAvatar" aria-hidden="true">
            {profileInitial}
          </div>
          <div>
            <h1>Профиль пользователя</h1>
            <p className="profileSubtitle">
              Ваш аккаунт Tetra и данные для доступа к личному пространству.
            </p>
          </div>
        </div>

        {isLoading && <p className="registerDescription">Загружаем пользователя...</p>}

        {user && (
          <div className="profileBox">
            {user.email && (
              <div className="profileRow">
                <span>Email</span>
                <strong>{user.email}</strong>
              </div>
            )}
            {user.name && (
              <div className="profileRow">
                <span>Имя</span>
                <strong>{user.name}</strong>
              </div>
            )}
            {user.id && (
              <div className="profileRow">
                <span>ID</span>
                <strong>{user.id}</strong>
              </div>
            )}
            {user.created_at && (
              <div className="profileRow">
                <span>Дата регистрации</span>
                <strong>{formatProfileDate(user.created_at)}</strong>
              </div>
            )}
          </div>
        )}

        {errorMessage && <p className="errorMessage">Ошибка: {errorMessage}</p>}

        <div className="authLinks">
          <button type="button" className="secondaryButton" onClick={handleLogout}>
            Выйти
          </button>
          <Link className="backLink" to="/">
            На главную
          </Link>
        </div>
      </section>
    </main>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/profile" element={<ProfilePage />} />
    </Routes>
  );
}

export default App;
