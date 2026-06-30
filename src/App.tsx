import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
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

type FileRecord = {
  id: string | number;
  original_name?: string;
  originalName?: string;
  mime_type?: string;
  mimeType?: string;
  size?: number;
  created_at?: string;
  createdAt?: string;
};

type FileListResponse = FileRecord[] | ({ files?: FileRecord[] } & ApiMessageResponse) | null;

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";

class AuthError extends Error {}

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

async function fetchProfileWithRefresh() {
  const response = await fetchWithAuth("/api/api/profile");
  const data = await readResponse<CurrentUserResponse & ApiMessageResponse>(response);

  return { response, data };
}

async function fetchWithAuth(input: RequestInfo | URL, init: RequestInit = {}) {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);

  if (!accessToken) {
    throw new AuthError("Access token is missing");
  }

  const response = await fetch(input, withAuthorization(init, accessToken));

  if (response.status !== 401) {
    return response;
  }

  let newAccessToken: string;

  try {
    newAccessToken = await refreshTokens();
  } catch (error) {
    throw new AuthError(error instanceof Error ? error.message : "Unable to refresh session");
  }

  return fetch(input, withAuthorization(init, newAccessToken));
}

function withAuthorization(init: RequestInit, accessToken: string): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  return {
    ...init,
    headers,
  };
}

async function fetchFiles() {
  const response = await fetchWithAuth("/api/api/files");
  const data = await readResponse<FileListResponse>(response);

  return { response, data };
}

async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetchWithAuth("/api/api/files", {
    method: "POST",
    body: formData,
  });
  const data = await readResponse<ApiMessageResponse>(response);

  return { response, data };
}

async function deleteFile(fileID: string | number) {
  const response = await fetchWithAuth(`/api/api/files/${fileID}`, {
    method: "DELETE",
  });
  const data = await readResponse<ApiMessageResponse>(response);

  return { response, data };
}

async function downloadFile(file: FileRecord) {
  const response = await fetchWithAuth(`/api/api/files/${file.id}`);

  if (!response.ok) {
    const data = await readResponse<ApiMessageResponse>(response);
    throw new Error(getErrorMessage(data, "Не удалось скачать файл"));
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = getFileName(file);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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

function formatFileDate(value?: string) {
  if (!value) {
    return "—";
  }

  return formatProfileDate(value);
}

function formatFileSize(value?: number) {
  if (!value) {
    return "0 Б";
  }

  const units = ["Б", "КБ", "МБ", "ГБ"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getFileName(file: FileRecord) {
  return file.original_name ?? file.originalName ?? `file-${file.id}`;
}

function getFileMimeType(file: FileRecord) {
  return file.mime_type ?? file.mimeType ?? "Файл";
}

function getFileCreatedAt(file: FileRecord) {
  return file.created_at ?? file.createdAt;
}

function getFilesFromResponse(data: FileListResponse) {
  if (!data) {
    return [];
  }

  return Array.isArray(data) ? data : data.files ?? [];
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
            <Link className="profileNavLink" to="/files">
              Файлы
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
            <Link className="primaryButton" to={isAuthenticated ? "/files" : "/register"}>
              {isAuthenticated ? "Открыть файлы" : "Создать аккаунт"}
            </Link>

            {isAuthenticated ? (
              <Link className="ghostButton" to="/profile">
                Профиль
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

  if (hasSavedAccessToken()) {
    return <Navigate to="/files" replace />;
  }

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
      navigate("/files");
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

function FilesPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUserResponse | null>(null);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);

    if (!accessToken) {
      navigate("/login");
      return;
    }

    async function loadProfile() {
      try {
        const { response: profileResponse, data: profileData } = await fetchProfileWithRefresh();

        if (profileResponse.status === 401) {
          clearTokens();
          navigate("/login");
          setIsLoading(false);
          return;
        }

        if (!profileResponse.ok) {
          setErrorMessage(getErrorMessage(profileData, "Не удалось загрузить профиль"));
          setIsLoading(false);
          return;
        }

        setUser(profileData);
      } catch (error) {
        if (error instanceof AuthError) {
          clearTokens();
          navigate("/login");
          setIsLoading(false);
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : "Backend is not available",
        );
        setIsLoading(false);
        return;
      }

      try {
        const { response: filesResponse, data: filesData } = await fetchFiles();

        if (filesResponse.ok) {
          setFiles(getFilesFromResponse(filesData));
        } else {
          setErrorMessage(getErrorMessage(!filesData || Array.isArray(filesData) ? {} : filesData, "Файловый API пока недоступен"));
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Файловый API пока недоступен",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadProfile();
  }, [navigate]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setErrorMessage("Выберите файл для загрузки");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsUploading(true);

    try {
      const { response, data } = await uploadFile(selectedFile);

      if (!response.ok) {
        setErrorMessage(getErrorMessage(data, "Не удалось загрузить файл"));
        return;
      }

      const { response: filesResponse, data: filesData } = await fetchFiles();

      if (filesResponse.ok) {
        setFiles(getFilesFromResponse(filesData));
      }

      setSelectedFile(null);
      setSuccessMessage("Файл загружен");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Backend is not available",
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDownload(file: FileRecord) {
    setErrorMessage("");

    try {
      await downloadFile(file);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось скачать файл",
      );
    }
  }

  async function handleDelete(file: FileRecord) {
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { response, data } = await deleteFile(file.id);

      if (!response.ok) {
        setErrorMessage(getErrorMessage(data, "Не удалось удалить файл"));
        return;
      }

      setFiles((currentFiles) => currentFiles.filter((currentFile) => currentFile.id !== file.id));
      setSuccessMessage("Файл удалён");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось удалить файл",
      );
    }
  }

  const profileInitial = user?.email?.trim().charAt(0).toUpperCase() ?? "T";

  return (
    <main className="appShell">
      <aside className="appSidebar">
        <Link className="brand appBrand" to="/files">
          <span className="brandMark">T</span>
          <span>Tetra</span>
        </Link>

        <nav className="appNav">
          <a className="appNavLink active" href="#files">Файлы</a>
          <a className="appNavLink disabled" href="#search">Поиск</a>
          <a className="appNavLink disabled" href="#trash">Корзина</a>
        </nav>
      </aside>

      <section className="appWorkspace" id="files">
        <header className="appHeader">
          <div>
            <p className="eyebrow">личное хранилище</p>
            <h1>Файлы</h1>
          </div>

          <Link className="accountPanel" to="/profile">
            <div className="profileAvatar small" aria-hidden="true">
              {profileInitial}
            </div>
            <div className="accountMeta">
              <strong>{user?.email ?? "Аккаунт"}</strong>
              {user?.created_at && <span>с {formatProfileDate(user.created_at)}</span>}
            </div>
          </Link>
        </header>

        <form className="uploadPanel" onSubmit={handleUpload}>
          <label className="filePicker">
            <span>{selectedFile ? selectedFile.name : "Выберите файл"}</span>
            <input
              type="file"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <button type="submit" className="primaryButton" disabled={isUploading}>
            {isUploading ? "Загружаем..." : "Загрузить"}
          </button>
        </form>

        {isLoading && <p className="registerDescription">Загружаем файловое пространство...</p>}
        {successMessage && <p className="successMessage">{successMessage}</p>}
        {errorMessage && <p className="errorMessage">Ошибка: {errorMessage}</p>}

        <div className="filesPanel">
          <div className="filesHeader">
            <span>Название</span>
            <span>Тип</span>
            <span>Размер</span>
            <span>Добавлен</span>
            <span>Действия</span>
          </div>

          {!isLoading && files.length === 0 && (
            <div className="emptyFiles">
              <h2>Здесь пока пусто</h2>
              <p>Когда backend для файлов будет готов, загруженные документы появятся в этом списке.</p>
            </div>
          )}

          {files.map((file) => (
            <div className="fileRow" key={file.id}>
              <strong>{getFileName(file)}</strong>
              <span>{getFileMimeType(file)}</span>
              <span>{formatFileSize(file.size)}</span>
              <span>{formatFileDate(getFileCreatedAt(file))}</span>
              <div className="fileActions">
                <button type="button" onClick={() => void handleDownload(file)}>
                  Скачать
                </button>
                <button type="button" className="dangerAction" onClick={() => void handleDelete(file)}>
                  Удалить
                </button>
              </div>
            </div>
          ))}
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
    if (!hasSavedAccessToken()) {
      navigate("/login");
      return;
    }

    async function loadProfile() {
      try {
        const { response, data } = await fetchProfileWithRefresh();

        if (response.status === 401) {
          clearTokens();
          navigate("/login");
          return;
        }

        if (!response.ok) {
          setErrorMessage(getErrorMessage(data, "Не удалось загрузить профиль"));
          return;
        }

        setUser(data);
      } catch (error) {
        if (error instanceof AuthError) {
          clearTokens();
          navigate("/login");
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : "Backend is not available",
        );
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
              Сведения об аккаунте Tetra.
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
          <Link className="backLink" to="/files">
            К файлам
          </Link>
          <button type="button" className="secondaryButton" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </section>
    </main>
  );
}

function RootPage() {
  if (hasSavedAccessToken()) {
    return <Navigate to="/files" replace />;
  }

  return <WelcomePage />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootPage />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/files" element={<FilesPage />} />
      <Route path="/profile" element={<ProfilePage />} />
    </Routes>
  );
}

export default App;
