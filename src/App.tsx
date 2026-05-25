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

async function readResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

function getErrorMessage(data: ApiMessageResponse, fallback: string) {
  return data.message || fallback;
}

function WelcomePage() {
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
          <Link to="/early-access">Попробовать</Link>
          <Link to="/login">Войти</Link>
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
            <Link className="primaryButton" to="/early-access">
              Навести порядок
            </Link>

            <Link className="ghostButton" to="/register">
              Создать аккаунт
            </Link>
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

function EarlyAccessPage() {
  const [email, setEmail] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setResultMessage("");
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await readResponse<ApiMessageResponse>(response);

      if (!response.ok) {
        setErrorMessage(getErrorMessage(data, "Не удалось отправить email"));
        return;
      }

      setResultMessage(getErrorMessage(data, "Email добавлен в список"));
      setEmail("");
    } catch {
      setErrorMessage("Backend is not available");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="registerPage">
      <section className="registerCard">
        <p className="eyebrow">ранний доступ</p>

        <h1>Попробовать Tetra</h1>

        <p className="registerDescription">
          Оставьте email, чтобы получить ранний доступ к Tetra. Мы собираем
          первых пользователей, которым нужен порядок в личных документах,
          чеках, договорах и файлах.
        </p>

        <form className="form" onSubmit={handleSubmit}>
          <label htmlFor="early-access-email">Email</label>

          <input
            id="early-access-email"
            name="email"
            type="email"
            placeholder="sasha@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <button type="submit" className="primaryButton" disabled={isSubmitting}>
            {isSubmitting ? "Отправляем..." : "Получить ранний доступ"}
          </button>
        </form>

        {resultMessage && (
          <p className="successMessage">Готово: {resultMessage}</p>
        )}

        {errorMessage && <p className="errorMessage">Ошибка: {errorMessage}</p>}

        <div className="authLinks">
          <Link className="backLink" to="/register">
            Уже готовы? Создать аккаунт
          </Link>
          <Link className="backLink" to="/">
            Назад на главную
          </Link>
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
          <Link className="backLink" to="/early-access">
            Только попробовать Tetra
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
        const response = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const data = await readResponse<CurrentUserResponse & ApiMessageResponse>(response);

        if (!response.ok) {
          setErrorMessage(getErrorMessage(data, "Не удалось загрузить профиль"));
          return;
        }

        setUser(data);
      } catch {
        setErrorMessage("Backend is not available");
      } finally {
        setIsLoading(false);
      }
    }

    void loadProfile();
  }, [navigate]);

  function handleLogout() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    navigate("/login");
  }

  return (
    <main className="registerPage">
      <section className="registerCard">
        <p className="eyebrow">профиль</p>
        <h1>Защищённая страница</h1>

        {isLoading && <p className="registerDescription">Загружаем пользователя...</p>}

        {user && (
          <div className="profileBox">
            {user.email && <p>Email: {user.email}</p>}
            {user.name && <p>Имя: {user.name}</p>}
            {user.id && <p>ID: {user.id}</p>}
          </div>
        )}

        {errorMessage && <p className="errorMessage">Ошибка: {errorMessage}</p>}

        <div className="authLinks">
          <button type="button" className="ghostButton" onClick={handleLogout}>
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
      <Route path="/early-access" element={<EarlyAccessPage />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/profile" element={<ProfilePage />} />
    </Routes>
  );
}

export default App;
