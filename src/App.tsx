import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import "./App.css";

type ApiMessageResponse = {
  status?: string;
  message?: string;
  error?: string;
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
  folder_id?: string | number | null;
  folderId?: string | number | null;
};

type FolderRecord = {
  id: string | number;
  name: string;
  parent_id?: string | number | null;
  parentId?: string | number | null;
  created_at?: string;
  createdAt?: string;
  has_content?: boolean;
  hasContent?: boolean;
};

type BreadcrumbItem = {
  id: string | number | null;
  name: string;
};

type FolderContentResponse = ApiMessageResponse & {
  current_folder?: FolderRecord | null;
  currentFolder?: FolderRecord | null;
  breadcrumbs?: BreadcrumbItem[];
  folders?: FolderRecord[];
  files?: FileRecord[];
};

type FolderActionResponse = ApiMessageResponse & {
  folder?: FolderRecord;
};

type FileActionResponse = ApiMessageResponse & {
  file?: FileRecord;
};

type ConfirmDialogState =
  | {
      kind: "delete-file";
      title: string;
      body: string;
      confirmText: string;
      item: FileRecord;
    }
  | {
      kind: "delete-folder";
      title: string;
      body: string;
      confirmText: string;
      item: FolderRecord;
    };

type ViewMode = "grid" | "list";
type SortMode = "date-desc" | "name-asc" | "size-desc";

type UploadProgress = {
  current: number;
  total: number;
  fileName: string;
};

type FilePreviewState = {
  file: FileRecord;
  kind: "image" | "pdf" | "text" | "details";
  objectUrl?: string;
  shouldRevokeObjectUrl?: boolean;
  text?: string;
  message?: string;
};

type InlinePreviewState = {
  kind: "empty" | "loading" | "image" | "pdf" | "text" | "details";
  objectUrl?: string;
  text?: string;
  message?: string;
};

type ActionMenuState =
  | {
      kind: "file";
      item: FileRecord;
      x: number;
      y: number;
    }
  | {
      kind: "folder";
      item: FolderRecord;
      x: number;
      y: number;
    };

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const ROOT_CRUMB: BreadcrumbItem = { id: null, name: "Мои файлы" };
const MAX_PREVIEW_SIZE = 8 * 1024 * 1024;
const MAX_TEXT_PREVIEW_SIZE = 2 * 1024 * 1024;

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
  return data.message || data.error || fallback;
}

async function refreshTokens() {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

  if (!refreshToken) {
    throw new AuthError("Refresh token is missing");
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
    throw new AuthError(getErrorMessage(data, "Не удалось обновить сессию"));
  }

  saveTokens(data);

  const accessToken = getAccessToken(data);

  if (!accessToken) {
    throw new AuthError("Backend did not return access token");
  }

  return accessToken;
}

function withAuthorization(init: RequestInit, accessToken: string): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  return {
    ...init,
    headers,
  };
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

  const newAccessToken = await refreshTokens();
  return fetch(input, withAuthorization(init, newAccessToken));
}

async function fetchProfileWithRefresh() {
  const response = await fetchWithAuth("/api/api/profile");
  const data = await readResponse<CurrentUserResponse & ApiMessageResponse>(response);

  return { response, data };
}

async function fetchFolderContent(folderID: string | number | null) {
  const params = new URLSearchParams();

  if (folderID !== null) {
    params.set("folder_id", String(folderID));
  }

  const url = `/api/api/folders/content${params.toString() ? `?${params}` : ""}`;
  const response = await fetchWithAuth(url);
  const data = await readResponse<FolderContentResponse>(response);

  return { response, data };
}

async function createFolder(name: string, parentID: string | number | null) {
  const normalizedParentID = parentID === null ? null : Number(parentID);

  const response = await fetchWithAuth("/api/api/folders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      parent_id: normalizedParentID,
    }),
  });
  const data = await readResponse<FolderActionResponse>(response);

  return { response, data };
}

async function renameFolder(folderID: string | number, name: string) {
  const response = await fetchWithAuth(`/api/api/folders/${folderID}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });
  const data = await readResponse<FolderActionResponse>(response);

  return { response, data };
}

async function deleteFolder(folderID: string | number) {
  const response = await fetchWithAuth(`/api/api/folders/${folderID}`, {
    method: "DELETE",
  });
  const data = await readResponse<ApiMessageResponse>(response);

  return { response, data };
}

async function uploadSingleFile(file: File, folderID: string | number | null) {
  const formData = new FormData();
  formData.append("file", file);

  if (folderID !== null) {
    formData.append("folder_id", String(folderID));
  }

  const response = await fetchWithAuth("/api/api/files", {
    method: "POST",
    body: formData,
  });
  const data = await readResponse<FileActionResponse>(response);

  return { response, data };
}

async function deleteFile(fileID: string | number) {
  const response = await fetchWithAuth(`/api/api/files/${fileID}`, {
    method: "DELETE",
  });
  const data = await readResponse<ApiMessageResponse>(response);

  return { response, data };
}

async function moveFile(fileID: string | number, folderID: string | number | null) {
  const response = await fetchWithAuth(`/api/api/files/${fileID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder_id: folderID === null ? null : Number(folderID) }),
  });
  const data = await readResponse<FileActionResponse>(response);

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

async function createFileObjectUrl(file: FileRecord) {
  const response = await fetchWithAuth(`/api/api/files/${file.id}`);

  if (!response.ok) {
    return null;
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

async function fetchFileBlob(file: FileRecord) {
  const response = await fetchWithAuth(`/api/api/files/${file.id}`);

  if (!response.ok) {
    const data = await readResponse<ApiMessageResponse>(response);
    throw new Error(getErrorMessage(data, "Не удалось открыть файл"));
  }

  return response.blob();
}

async function decodeTextBlob(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  const utf8Text = new TextDecoder("utf-8").decode(buffer);

  if (!utf8Text.includes("\uFFFD")) {
    return utf8Text;
  }

  try {
    return new TextDecoder("windows-1251").decode(buffer);
  } catch {
    return utf8Text;
  }
}

function normalizeFolderContent(data: FolderContentResponse) {
  const breadcrumbs = data.breadcrumbs?.length ? data.breadcrumbs : [ROOT_CRUMB];
  const normalizedBreadcrumbs = breadcrumbs.map((crumb, index) =>
    index === 0 && crumb.id === null ? ROOT_CRUMB : crumb,
  );

  return {
    currentFolder: data.current_folder ?? data.currentFolder ?? null,
    breadcrumbs: normalizedBreadcrumbs,
    folders: data.folders ?? [],
    files: data.files ?? [],
  };
}

function formatDate(value?: string) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

function getFileNameParts(file: FileRecord) {
  const name = getFileName(file);
  const dotIndex = name.lastIndexOf(".");

  if (dotIndex <= 0 || dotIndex === name.length - 1) {
    return { baseName: name, extension: "" };
  }

  return {
    baseName: name.slice(0, dotIndex),
    extension: name.slice(dotIndex),
  };
}

function getFileMimeType(file: FileRecord) {
  return file.mime_type ?? file.mimeType ?? "Файл";
}

function getFileCreatedAt(file: FileRecord) {
  return file.created_at ?? file.createdAt;
}

function getFolderCreatedAt(folder: FolderRecord) {
  return folder.created_at ?? folder.createdAt;
}

function folderHasContent(folder: FolderRecord) {
  return Boolean(folder.has_content ?? folder.hasContent);
}

function getFileKind(file: FileRecord) {
  const name = getFileName(file).toLowerCase();
  const mime = getFileMimeType(file).toLowerCase();

  if (mime.includes("image") || /\.(png|jpe?g|webp|gif|svg)$/.test(name)) {
    return "image";
  }

  if (mime.includes("pdf") || name.endsWith(".pdf")) {
    return "pdf";
  }

  if (mime.includes("zip") || /\.(zip|rar|7z|tar|gz)$/.test(name)) {
    return "archive";
  }

  if (mime.includes("text") || /\.(txt|md|csv|json|log|bsl|html?|css|js|jsx|ts|tsx|go|sql|xml|ya?ml|toml|ini|env)$/.test(name)) {
    return "text";
  }

  if (/\.(docx?|xlsx?|pptx?)$/.test(name)) {
    return "office";
  }

  return "file";
}

function isImageFile(file: FileRecord) {
  return getFileKind(file) === "image" && (file.size ?? 0) <= MAX_PREVIEW_SIZE;
}

function IconFolder() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M5 13.5A5.5 5.5 0 0 1 10.5 8h10.2l4.2 4.5h12.6A5.5 5.5 0 0 1 43 18v17.5A5.5 5.5 0 0 1 37.5 41h-27A5.5 5.5 0 0 1 5 35.5v-22Z" />
      <path d="M5 19h38v16.5A5.5 5.5 0 0 1 37.5 41h-27A5.5 5.5 0 0 1 5 35.5V19Z" />
    </svg>
  );
}

function IconFile({ kind }: { kind: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M12 5h16l8 8v30H12V5Z" />
      <path d="M28 5v9h8" />
      <text x="24" y="31" textAnchor="middle">
        {kind === "image" ? "IMG" : kind === "pdf" ? "PDF" : kind === "archive" ? "ZIP" : kind === "text" ? "TXT" : kind === "office" ? "DOC" : "FILE"}
      </text>
    </svg>
  );
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
        setErrorMessage(getErrorMessage(data, isRegister ? "Не удалось зарегистрироваться" : "Не удалось войти"));
        return;
      }

      saveTokens(data);
      navigate("/files");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Backend is not available");
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
            ? "Введите email и пароль, чтобы создать аккаунт и перейти в файловое пространство."
            : "Введите email и пароль, чтобы открыть файловое пространство."}
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
            {isSubmitting ? "Проверяем..." : isRegister ? "Зарегистрироваться" : "Войти"}
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
  const [searchParams, setSearchParams] = useSearchParams();
  const folderID = searchParams.get("folder_id");
  const currentFolderID = folderID || null;

  const [user, setUser] = useState<CurrentUserResponse | null>(null);
  const [currentFolder, setCurrentFolder] = useState<FolderRecord | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([ROOT_CRUMB]);
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [folderNameDraft, setFolderNameDraft] = useState("");
  const [renameTarget, setRenameTarget] = useState<FolderRecord | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortMode, setSortMode] = useState<SortMode>("date-desc");
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [actionMenu, setActionMenu] = useState<ActionMenuState | null>(null);
  const [filePreview, setFilePreview] = useState<FilePreviewState | null>(null);
  const [previewLoadingFileID, setPreviewLoadingFileID] = useState<string | number | null>(null);
  const [selectedPreviewFile, setSelectedPreviewFile] = useState<FileRecord | null>(null);
  const [inlinePreview, setInlinePreview] = useState<InlinePreviewState>({ kind: "empty" });
  const [dropTargetFolderID, setDropTargetFolderID] = useState<string | number | null>(null);
  const [movingFileID, setMovingFileID] = useState<string | number | null>(null);

  const totalItems = folders.length + files.length;
  const profileInitial = user?.email?.trim().charAt(0).toUpperCase() ?? "T";
  const pageTitle = currentFolder?.name ?? "Мои файлы";
  const parentCrumb = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : null;

  const selectedFilesLabel = useMemo(() => {
    if (selectedFiles.length === 0) {
      return "Выберите файлы";
    }

    if (selectedFiles.length === 1) {
      return selectedFiles[0].name;
    }

    return `${selectedFiles.length} файла выбрано`;
  }, [selectedFiles]);

  const sortedFolders = useMemo(() => {
    const nextFolders = [...folders];

    return nextFolders.sort((left, right) => left.name.localeCompare(right.name, "ru"));
  }, [folders]);

  const sortedFiles = useMemo(() => {
    const nextFiles = [...files];

    return nextFiles.sort((left, right) => {
      if (sortMode === "name-asc") {
        return getFileName(left).localeCompare(getFileName(right), "ru");
      }

      if (sortMode === "size-desc") {
        return (right.size ?? 0) - (left.size ?? 0);
      }

      return new Date(getFileCreatedAt(right) ?? 0).getTime() - new Date(getFileCreatedAt(left) ?? 0).getTime();
    });
  }, [files, sortMode]);

  const sortLabel =
    sortMode === "name-asc" ? "По имени" : sortMode === "size-desc" ? "По размеру" : "Сначала новые";
  const shouldShowListPreview = viewMode === "list" && sortedFiles.length > 0;

  useEffect(() => {
    if (!hasSavedAccessToken()) {
      navigate("/login");
      return;
    }

    let ignore = false;

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

        if (!ignore) {
          setUser(data);
        }
      } catch (error) {
        if (error instanceof AuthError) {
          clearTokens();
          navigate("/login");
          return;
        }

        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : "Backend is not available");
        }
      }
    }

    void loadProfile();

    return () => {
      ignore = true;
    };
  }, [navigate]);

  useEffect(() => {
    if (!hasSavedAccessToken()) {
      return;
    }

    let ignore = false;

    async function loadContent() {
      setIsLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      try {
        const { response, data } = await fetchFolderContent(currentFolderID);

        if (!response.ok) {
          setErrorMessage(getErrorMessage(data, "Не удалось загрузить папку"));
          return;
        }

        const normalized = normalizeFolderContent(data);

        if (!ignore) {
          setCurrentFolder(normalized.currentFolder);
          setBreadcrumbs(normalized.breadcrumbs);
          setFolders(normalized.folders);
          setFiles(normalized.files);
        }
      } catch (error) {
        if (error instanceof AuthError) {
          clearTokens();
          navigate("/login");
          return;
        }

        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : "Файловый API недоступен");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadContent();

    return () => {
      ignore = true;
    };
  }, [currentFolderID, navigate]);

  useEffect(() => {
    const imageFiles = files.filter(isImageFile);
    let ignore = false;
    const objectUrls: string[] = [];

    async function loadPreviews() {
      await Promise.resolve();

      if (!ignore) {
        setPreviewUrls({});
      }

      for (const file of imageFiles) {
        const key = String(file.id);
        const objectUrl = await createFileObjectUrl(file);

        if (!objectUrl) {
          continue;
        }

        if (ignore) {
          URL.revokeObjectURL(objectUrl);
          continue;
        }

        objectUrls.push(objectUrl);
        setPreviewUrls((currentUrls) => ({
          ...currentUrls,
          [key]: objectUrl,
        }));
      }
    }

    void loadPreviews();

    return () => {
      ignore = true;
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [files]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeoutID = window.setTimeout(() => setSuccessMessage(""), 2600);

    return () => window.clearTimeout(timeoutID);
  }, [successMessage]);

  useEffect(() => {
    setSelectedPreviewFile((currentFile) => {
      if (!currentFile) {
        return null;
      }

      return files.some((file) => String(file.id) === String(currentFile.id)) ? currentFile : null;
    });
  }, [files]);

  useEffect(() => {
    if (!selectedPreviewFile || viewMode !== "list") {
      setInlinePreview({ kind: "empty" });
      return;
    }

    const previewFile = selectedPreviewFile;
    const kind = getFileKind(previewFile);
    const cachedImageUrl = previewUrls[String(previewFile.id)];
    let ignore = false;
    let objectUrlToRevoke: string | null = null;

    if (kind === "image" && cachedImageUrl) {
      setInlinePreview({ kind: "image", objectUrl: cachedImageUrl });
      return;
    }

    async function loadInlinePreview() {
      setInlinePreview({ kind: "loading" });

      try {
        if (kind === "image" || kind === "pdf") {
          const blob = await fetchFileBlob(previewFile);
          const objectUrl = URL.createObjectURL(blob);
          objectUrlToRevoke = objectUrl;

          if (ignore) {
            URL.revokeObjectURL(objectUrl);
            objectUrlToRevoke = null;
            return;
          }

          if (!ignore) {
            setInlinePreview({ kind, objectUrl });
          }

          return;
        }

        if (kind === "text") {
          if ((previewFile.size ?? 0) > MAX_TEXT_PREVIEW_SIZE) {
            setInlinePreview({
              kind: "details",
              message: "Текстовый файл слишком большой для быстрого предпросмотра. Его можно открыть отдельно или скачать.",
            });
            return;
          }

          const blob = await fetchFileBlob(previewFile);
          const text = await decodeTextBlob(blob);

          if (!ignore) {
            setInlinePreview({ kind: "text", text });
          }

          return;
        }

        setInlinePreview({
          kind: "details",
          message: "Для этого типа файла пока доступно открытие в отдельном окне предпросмотра или скачивание.",
        });
      } catch (error) {
        if (!ignore) {
          setInlinePreview({
            kind: "details",
            message: error instanceof Error ? error.message : "Не удалось загрузить предпросмотр.",
          });
        }
      }
    }

    void loadInlinePreview();

    return () => {
      ignore = true;

      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [previewUrls, selectedPreviewFile, viewMode]);

  useEffect(() => {
    if (!actionMenu) {
      return;
    }

    function closeMenu() {
      setActionMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    window.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [actionMenu]);

  useEffect(() => {
    return () => {
      if (filePreview?.objectUrl && filePreview.shouldRevokeObjectUrl) {
        URL.revokeObjectURL(filePreview.objectUrl);
      }
    };
  }, [filePreview]);

  function openFolder(id: string | number | null) {
    setActionMenu(null);
    setSelectedPreviewFile(null);

    if (id === null) {
      setSearchParams({});
      return;
    }

    setSearchParams({ folder_id: String(id) });
  }

  async function reloadCurrentFolder() {
    const { response, data } = await fetchFolderContent(currentFolderID);

    if (!response.ok) {
      setErrorMessage(getErrorMessage(data, "Не удалось обновить папку"));
      return;
    }

    const normalized = normalizeFolderContent(data);
    setCurrentFolder(normalized.currentFolder);
    setBreadcrumbs(normalized.breadcrumbs);
    setFolders(normalized.folders);
    setFiles(normalized.files);
  }

  async function handleCreateFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = folderNameDraft.trim();

    if (!name) {
      setErrorMessage("Введите название папки");
      return;
    }

    setPendingAction("create-folder");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { response, data } = await createFolder(name, currentFolderID);

      if (!response.ok) {
        setErrorMessage(getErrorMessage(data, "Не удалось создать папку"));
        return;
      }

      setFolderNameDraft("");
      setIsCreatingFolder(false);
      await reloadCurrentFolder();
      setSuccessMessage("Папка создана");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось создать папку");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRenameFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!renameTarget) {
      return;
    }

    const name = renameDraft.trim();

    if (!name) {
      setErrorMessage("Введите новое название папки");
      return;
    }

    setPendingAction("rename-folder");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { response, data } = await renameFolder(renameTarget.id, name);

      if (!response.ok) {
        setErrorMessage(getErrorMessage(data, "Не удалось переименовать папку"));
        return;
      }

      setRenameTarget(null);
      setRenameDraft("");
      await reloadCurrentFolder();
      setSuccessMessage("Папка переименована");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось переименовать папку");
    } finally {
      setPendingAction(null);
    }
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const filesToUpload = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (filesToUpload.length > 0) {
      setSelectedFiles(filesToUpload);
      void uploadFiles(filesToUpload);
    }
  }

  function isInternalFileDrag(event: DragEvent<HTMLElement>) {
    return Array.from(event.dataTransfer.types).includes("application/x-tetra-file-id");
  }

  function handleFileDragStart(event: DragEvent<HTMLElement>, file: FileRecord) {
    setActionMenu(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-tetra-file-id", String(file.id));
    event.dataTransfer.setData("text/plain", getFileName(file));
  }

  function handleFileDragEnd() {
    setDropTargetFolderID(null);
  }

  function handleFolderDragOver(event: DragEvent<HTMLElement>, folder: FolderRecord) {
    if (!isInternalFileDrag(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setIsDragActive(false);
    setDropTargetFolderID(folder.id);
  }

  function handleFolderDragLeave(event: DragEvent<HTMLElement>, folder: FolderRecord) {
    if (event.currentTarget === event.target && String(dropTargetFolderID) === String(folder.id)) {
      setDropTargetFolderID(null);
    }
  }

  async function handleFolderDrop(event: DragEvent<HTMLElement>, folder: FolderRecord) {
    if (!isInternalFileDrag(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDropTargetFolderID(null);

    const fileID = event.dataTransfer.getData("application/x-tetra-file-id");

    if (!fileID) {
      return;
    }

    await moveFileToFolder(fileID, folder.id);
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    if (isInternalFileDrag(event) || !Array.from(event.dataTransfer.types).includes("Files")) {
      return;
    }

    event.preventDefault();
    setIsDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    if (event.currentTarget === event.target) {
      setIsDragActive(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    if (isInternalFileDrag(event)) {
      setIsDragActive(false);
      return;
    }

    event.preventDefault();
    setIsDragActive(false);

    const droppedFiles = Array.from(event.dataTransfer.files ?? []);

    if (droppedFiles.length > 0) {
      setSelectedFiles(droppedFiles);
      void uploadFiles(droppedFiles);
    }
  }

  async function moveFileToFolder(fileID: string | number, targetFolderID: string | number | null) {
    setMovingFileID(fileID);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { response, data } = await moveFile(fileID, targetFolderID);

      if (!response.ok) {
        setErrorMessage(getErrorMessage(data, "Не удалось переместить файл"));
        return;
      }

      setSelectedPreviewFile((currentFile) => (currentFile && String(currentFile.id) === String(fileID) ? null : currentFile));
      await reloadCurrentFolder();
      setSuccessMessage("Файл перемещён");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось переместить файл");
    } finally {
      setMovingFileID(null);
    }
  }

  async function uploadFiles(filesToUpload: File[]) {
    if (filesToUpload.length === 0) {
      setErrorMessage("Выберите файл для загрузки");
      return;
    }

    setIsUploading(true);
    setUploadProgress(null);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      for (const [index, file] of filesToUpload.entries()) {
        setUploadProgress({
          current: index + 1,
          total: filesToUpload.length,
          fileName: file.name,
        });

        const { response, data } = await uploadSingleFile(file, currentFolderID);

        if (!response.ok) {
          setErrorMessage(getErrorMessage(data, `Не удалось загрузить ${file.name}`));
          return;
        }
      }

      setSelectedFiles([]);
      await reloadCurrentFolder();
      setSuccessMessage(filesToUpload.length === 1 ? "Файл загружен" : "Файлы загружены");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить файл");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  }

  async function handleDownload(file: FileRecord) {
    setErrorMessage("");

    try {
      await downloadFile(file);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось скачать файл");
    }
  }

  async function handleOpenFile(file: FileRecord) {
    const kind = getFileKind(file);
    setActionMenu(null);
    setErrorMessage("");

    if (kind === "image" && previewUrls[String(file.id)]) {
      setFilePreview({ file, kind: "image", objectUrl: previewUrls[String(file.id)] });
      return;
    }

    if (kind === "pdf") {
      setPreviewLoadingFileID(file.id);
      try {
        const blob = await fetchFileBlob(file);
        setFilePreview({ file, kind: "pdf", objectUrl: URL.createObjectURL(blob), shouldRevokeObjectUrl: true });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Не удалось открыть PDF");
      } finally {
        setPreviewLoadingFileID(null);
      }
      return;
    }

    if (kind === "text") {
      if ((file.size ?? 0) > MAX_TEXT_PREVIEW_SIZE) {
        setFilePreview({
          file,
          kind: "details",
          message: "Файл слишком большой для безопасного предпросмотра. Его можно скачать.",
        });
        return;
      }

      setPreviewLoadingFileID(file.id);
      try {
        const blob = await fetchFileBlob(file);
        setFilePreview({ file, kind: "text", text: await decodeTextBlob(blob) });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Не удалось открыть текстовый файл");
      } finally {
        setPreviewLoadingFileID(null);
      }
      return;
    }

    setFilePreview({
      file,
      kind: "details",
      message: "Для этого типа файла пока доступно скачивание.",
    });
  }

  function requestDeleteFile(file: FileRecord) {
    setActionMenu(null);
    setConfirmDialog({
      kind: "delete-file",
      title: `Удалить файл «${getFileName(file)}»?`,
      body: "Файл будет удалён из текущей папки.",
      confirmText: "Удалить файл",
      item: file,
    });
  }

  function requestDeleteFolder(folder: FolderRecord) {
    setActionMenu(null);
    setConfirmDialog({
      kind: "delete-folder",
      title: `Удалить папку «${folder.name}»?`,
      body: "Будут удалены все вложенные папки и файлы внутри. Это действие нельзя отменить.",
      confirmText: "Удалить папку",
      item: folder,
    });
  }

  async function handleConfirmDelete() {
    if (!confirmDialog) {
      return;
    }

    setPendingAction("delete");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (confirmDialog.kind === "delete-file") {
        const { response, data } = await deleteFile(confirmDialog.item.id);

        if (!response.ok) {
          setErrorMessage(getErrorMessage(data, "Не удалось удалить файл"));
          return;
        }

        setFiles((currentFiles) => currentFiles.filter((file) => file.id !== confirmDialog.item.id));
        setSuccessMessage("Файл удалён");
      } else {
        const { response, data } = await deleteFolder(confirmDialog.item.id);

        if (!response.ok) {
          setErrorMessage(getErrorMessage(data, "Не удалось удалить папку"));
          return;
        }

        await reloadCurrentFolder();
        setSuccessMessage("Папка удалена");
      }

      setConfirmDialog(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось удалить");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <main className="appShell">
      <aside className="appSidebar">
        <div className="appSidebarTop">
          <Link className="brand appBrand" to="/files">
            <span className="brandMark">T</span>
            <span>Tetra</span>
          </Link>

          <Link className="accountPanel mobileAccountPanel" to="/profile">
            <div className="profileAvatar small" aria-hidden="true">
              {profileInitial}
            </div>
            <div className="accountMeta">
              <strong>{user?.email ?? "Аккаунт"}</strong>
              {user?.created_at && <span>с {formatDate(user.created_at)}</span>}
            </div>
          </Link>
        </div>

        <nav className="appNav">
          <button className="appNavLink active" type="button" onClick={() => openFolder(null)}>
            <span className="navIcon">▦</span>
            Файлы
          </button>
          <Link className="appNavLink" to="/">
            <span className="navIcon">⌂</span>
            Главная
          </Link>
          <button className="appNavLink disabled" type="button" disabled>
            <span className="navIcon">⌕</span>
            Поиск
          </button>
          <button className="appNavLink disabled" type="button" disabled>
            <span className="navIcon">⌫</span>
            Корзина
          </button>
        </nav>
      </aside>

      <section className="appWorkspace">
        <header className="appHeader">
          <div className="headerTitle">
            <div className="folderNavLine">
              {parentCrumb && (
                <button className="backFolderButton" type="button" onClick={() => openFolder(parentCrumb.id)}>
                  <span aria-hidden="true">←</span>
                  Назад
                </button>
              )}

              <div className="breadcrumbs" aria-label="Путь">
                {breadcrumbs.map((crumb, index) => (
                  <button
                    className={`breadcrumbButton ${index === breadcrumbs.length - 1 ? "current" : ""}`}
                    key={`${crumb.id ?? "root"}-${index}`}
                    type="button"
                    onClick={() => openFolder(crumb.id)}
                  >
                    {index > 0 && <span className="breadcrumbSep">/</span>}
                    <span>{crumb.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <h1>{pageTitle}</h1>
            <p>{totalItems} объектов</p>
          </div>

          <Link className="accountPanel headerAccountPanel" to="/profile">
            <div className="profileAvatar small" aria-hidden="true">
              {profileInitial}
            </div>
            <div className="accountMeta">
              <strong>{user?.email ?? "Аккаунт"}</strong>
              {user?.created_at && <span>с {formatDate(user.created_at)}</span>}
            </div>
          </Link>
        </header>

        <div className="workspaceToolbar">
          <div className="toolbarGroup">
            <button className="toolbarButton folderTool" type="button" onClick={() => setIsCreatingFolder(true)}>
              <span>+</span>
              Папка
            </button>

            <div className="uploadControl">
              <label className={`toolbarButton uploadPicker primaryTool ${isUploading ? "disabled" : ""}`}>
                <span>⇧</span>
                {isUploading ? "Загружаю..." : selectedFiles.length > 0 ? selectedFilesLabel : "Загрузить файлы"}
                <input disabled={isUploading} multiple type="file" onChange={handleFileSelection} />
              </label>
            </div>
          </div>

          <div className="toolbarGroup toolbarGroupRight">
            <div className="sortMenu">
              <button
                className="sortControl"
                type="button"
                aria-expanded={isSortMenuOpen}
                onClick={() => setIsSortMenuOpen((isOpen) => !isOpen)}
              >
                <span>Сортировка</span>
                <strong>{sortLabel}</strong>
                <span aria-hidden="true">⌄</span>
              </button>

              {isSortMenuOpen && (
                <div className="sortMenuList">
                  {[
                    ["date-desc", "Сначала новые"],
                    ["name-asc", "По имени"],
                    ["size-desc", "По размеру"],
                  ].map(([value, label]) => (
                    <button
                      className={sortMode === value ? "active" : ""}
                      key={value}
                      type="button"
                      onClick={() => {
                        setSortMode(value as SortMode);
                        setIsSortMenuOpen(false);
                        setActionMenu(null);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="viewSwitch" aria-label="Режим отображения">
              <button
                className={viewMode === "grid" ? "active" : ""}
                type="button"
                onClick={() => {
                  setViewMode("grid");
                  setActionMenu(null);
                  setSelectedPreviewFile(null);
                }}
              >
                Плитка
              </button>
              <button
                className={viewMode === "list" ? "active" : ""}
                type="button"
                onClick={() => {
                  setViewMode("list");
                  setActionMenu(null);
                }}
              >
                Список
              </button>
            </div>
          </div>
        </div>

        {uploadProgress && (
          <div className="uploadProgress">
            <div>
              <strong>
                Загружается {uploadProgress.current} из {uploadProgress.total}
              </strong>
              <span>{uploadProgress.fileName}</span>
            </div>
            <progress value={uploadProgress.current} max={uploadProgress.total} />
          </div>
        )}

        {errorMessage && <p className="errorMessage">Ошибка: {errorMessage}</p>}
        {successMessage && <div className="toastMessage">{successMessage}</div>}

        <section
          className={`fileSurface ${viewMode === "list" ? "listSurface" : ""} ${isDragActive ? "dragActive" : ""}`}
          aria-busy={isLoading}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {isDragActive && <div className="dropHint">Отпустите файлы, загрузка начнётся сразу</div>}

          {isLoading ? (
            <div className="loadingState">Загружаем файловое пространство...</div>
          ) : totalItems === 0 ? (
            <div className="emptyState">
              <div className="emptyDropIcon">⇧</div>
              <h2>Папка пуста</h2>
              <p>Перетащите файлы сюда, загрузите их через кнопку или создайте папку для будущего порядка.</p>
              <div className="emptyActions">
                <label className={`toolbarButton uploadPicker primaryTool ${isUploading ? "disabled" : ""}`}>
                  <span>⇧</span>
                  {isUploading ? "Загружаю..." : "Загрузить файлы"}
                  <input disabled={isUploading} multiple type="file" onChange={handleFileSelection} />
                </label>
                <button className="toolbarButton folderTool" type="button" onClick={() => setIsCreatingFolder(true)}>
                  <span>+</span>
                  Папка
                </button>
              </div>
            </div>
          ) : (
            <div className={`contentSections ${viewMode === "list" ? "listView" : ""} ${shouldShowListPreview ? "withPreviewPane" : ""}`}>
              <div className="contentMainColumn">
                {sortedFolders.length > 0 && (
                <section className="contentGroup">
                  <div className="contentGroupHeader">
                    <h2>Папки</h2>
                    <span>{sortedFolders.length}</span>
                  </div>

                  <div className="itemGrid">
                    {viewMode === "list" && (
                      <div className="listHeader" aria-hidden="true">
                        <span>Название</span>
                        <span>Тип</span>
                        <span>Добавлен</span>
                        <span></span>
                      </div>
                    )}

                    {sortedFolders.map((folder) => (
                      <article
                        className={`fsItem folderItem ${String(dropTargetFolderID) === String(folder.id) ? "dropTarget" : ""}`}
                        key={`folder-${folder.id}`}
                        onDragLeave={(event) => handleFolderDragLeave(event, folder)}
                        onDragOver={(event) => handleFolderDragOver(event, folder)}
                        onDrop={(event) => void handleFolderDrop(event, folder)}
                      >
                        <button className="itemOpenButton" type="button" onClick={() => openFolder(folder.id)}>
                          <span className={`itemIcon folderIcon ${folderHasContent(folder) ? "hasContent" : ""}`}>
                            <IconFolder />
                            {folderHasContent(folder) && (
                              <span className="folderContentBadge" aria-label="В папке есть содержимое">
                                <span />
                                <span />
                                <span />
                              </span>
                            )}
                          </span>
                          <span className="itemName">{folder.name}</span>
                          <span className="itemMeta">
                            <span className="itemSize">{folderHasContent(folder) ? "Есть содержимое" : "Пустая папка"}</span>
                            <span className="itemDate">{formatDate(getFolderCreatedAt(folder))}</span>
                          </span>
                        </button>

                        <div className="itemActions">
                          <button
                            type="button"
                            title="Действия"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActionMenu((currentMenu) =>
                                currentMenu?.kind === "folder" && currentMenu.item.id === folder.id
                                  ? null
                                  : { kind: "folder", item: folder, x: event.clientX, y: event.clientY },
                              );
                            }}
                          >
                            ...
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

                {sortedFiles.length > 0 && (
                <section className="contentGroup">
                  <div className="contentGroupHeader">
                    <h2>Файлы</h2>
                    <span>{sortedFiles.length}</span>
                  </div>

                  <div className="itemGrid">
                    {viewMode === "list" && (
                      <div className="listHeader" aria-hidden="true">
                        <span>Название</span>
                        <span>Размер</span>
                        <span>Добавлен</span>
                        <span></span>
                      </div>
                    )}

                    {sortedFiles.map((file) => {
                      const kind = getFileKind(file);
                      const filePreviewUrl = previewUrls[String(file.id)];
                      const { baseName, extension } = getFileNameParts(file);

                      return (
                        <article
                          className={`fsItem fileItem ${kind} ${selectedPreviewFile && String(selectedPreviewFile.id) === String(file.id) ? "selected" : ""} ${String(movingFileID) === String(file.id) ? "moving" : ""}`}
                          draggable
                          key={`file-${file.id}`}
                          onDragEnd={handleFileDragEnd}
                          onDragStart={(event) => handleFileDragStart(event, file)}
                        >
                          <button
                            className="itemOpenButton"
                            type="button"
                            onClick={() => {
                              if (viewMode === "list") {
                                setSelectedPreviewFile(file);
                                return;
                              }

                              void handleOpenFile(file);
                            }}
                            onDoubleClick={() => void handleOpenFile(file)}
                          >
                            <span className="itemIcon fileIcon">
                              {filePreviewUrl ? <img src={filePreviewUrl} alt="" /> : <IconFile kind={kind} />}
                            </span>
                            <span className="itemName" title={getFileName(file)}>
                              <span className="fileBaseName">{baseName}</span>
                              {extension && <span className="fileExtension">{extension}</span>}
                            </span>
                            <span className="itemMeta">
                              <span className="itemSize">{formatFileSize(file.size)}</span>
                              <span className="itemDate">{formatDate(getFileCreatedAt(file))}</span>
                            </span>
                          </button>

                          <div className="itemActions">
                            <button
                              type="button"
                              title="Действия"
                              onClick={(event) => {
                                event.stopPropagation();
                                setActionMenu((currentMenu) =>
                                  currentMenu?.kind === "file" && currentMenu.item.id === file.id
                                    ? null
                                    : { kind: "file", item: file, x: event.clientX, y: event.clientY },
                                );
                              }}
                            >
                              ...
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
                )}
              </div>

              {shouldShowListPreview && (
                <aside className="listPreviewPane" aria-label="Предпросмотр файла">
                  {selectedPreviewFile ? (
                    <>
                      <div className={`listPreviewMedia ${getFileKind(selectedPreviewFile)}`}>
                        {inlinePreview.kind === "loading" && <span className="listPreviewLoader">Загружаем предпросмотр...</span>}
                        {inlinePreview.kind === "image" && inlinePreview.objectUrl && (
                          <img src={inlinePreview.objectUrl} alt={getFileName(selectedPreviewFile)} />
                        )}
                        {inlinePreview.kind === "pdf" && inlinePreview.objectUrl && (
                          <iframe src={inlinePreview.objectUrl} title={getFileName(selectedPreviewFile)} />
                        )}
                        {inlinePreview.kind === "text" && (
                          <pre>{inlinePreview.text || "Файл пуст"}</pre>
                        )}
                        {(inlinePreview.kind === "empty" || inlinePreview.kind === "details") && (
                          <IconFile kind={getFileKind(selectedPreviewFile)} />
                        )}
                      </div>
                      <div className="listPreviewInfo">
                        <span className="listPreviewKicker">{getFileMimeType(selectedPreviewFile)}</span>
                        <h2>{getFileName(selectedPreviewFile)}</h2>
                        {inlinePreview.kind === "details" && inlinePreview.message && <p>{inlinePreview.message}</p>}
                        <dl>
                          <div>
                            <dt>Размер</dt>
                            <dd>{formatFileSize(selectedPreviewFile.size)}</dd>
                          </div>
                          <div>
                            <dt>Добавлен</dt>
                            <dd>{formatDate(getFileCreatedAt(selectedPreviewFile))}</dd>
                          </div>
                        </dl>
                      </div>
                      <div className="listPreviewActions">
                        <button type="button" onClick={() => void handleOpenFile(selectedPreviewFile)}>
                          Открыть
                        </button>
                        <button type="button" onClick={() => void handleDownload(selectedPreviewFile)}>
                          Скачать
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="listPreviewEmpty">
                      <IconFile kind="file" />
                      <h2>Выберите файл</h2>
                      <p>В списке справа появится краткий предпросмотр, размер и дата добавления.</p>
                    </div>
                  )}
                </aside>
              )}
            </div>
          )}
        </section>
      </section>

      {actionMenu && (
        <div className="actionMenuLayer" onClick={() => setActionMenu(null)}>
          <div
            className="floatingActionMenu"
            style={{ left: actionMenu.x, top: actionMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            {actionMenu.kind === "folder" ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setRenameTarget(actionMenu.item);
                    setRenameDraft(actionMenu.item.name);
                    setActionMenu(null);
                  }}
                >
                  Переименовать
                </button>
                <button className="dangerMenuButton" type="button" onClick={() => requestDeleteFolder(actionMenu.item)}>
                  Удалить
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={previewLoadingFileID === actionMenu.item.id}
                  onClick={() => void handleOpenFile(actionMenu.item)}
                >
                  {previewLoadingFileID === actionMenu.item.id ? "Открываю..." : "Открыть"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleDownload(actionMenu.item);
                    setActionMenu(null);
                  }}
                >
                  Скачать
                </button>
                <button className="dangerMenuButton" type="button" onClick={() => requestDeleteFile(actionMenu.item)}>
                  Удалить
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {isCreatingFolder && (
        <Modal title="Новая папка" onClose={() => setIsCreatingFolder(false)}>
          <form className="modalForm" onSubmit={handleCreateFolder}>
            <label htmlFor="new-folder-name">Название</label>
            <input
              id="new-folder-name"
              autoFocus
              value={folderNameDraft}
              onChange={(event) => setFolderNameDraft(event.target.value)}
            />
            <div className="modalActions">
              <button className="ghostButton" type="button" onClick={() => setIsCreatingFolder(false)}>
                Отмена
              </button>
              <button className="primaryButton" type="submit" disabled={pendingAction === "create-folder"}>
                Создать
              </button>
            </div>
          </form>
        </Modal>
      )}

      {renameTarget && (
        <Modal title="Переименовать папку" onClose={() => setRenameTarget(null)}>
          <form className="modalForm" onSubmit={handleRenameFolder}>
            <label htmlFor="rename-folder-name">Название</label>
            <input
              id="rename-folder-name"
              autoFocus
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
            />
            <div className="modalActions">
              <button className="ghostButton" type="button" onClick={() => setRenameTarget(null)}>
                Отмена
              </button>
              <button className="primaryButton" type="submit" disabled={pendingAction === "rename-folder"}>
                Сохранить
              </button>
            </div>
          </form>
        </Modal>
      )}

      {filePreview && (
        <Modal title={getFileName(filePreview.file)} onClose={() => setFilePreview(null)}>
          <div className={`previewDialog ${filePreview.kind}`}>
            {filePreview.kind === "image" && filePreview.objectUrl && (
              <img src={filePreview.objectUrl} alt={getFileName(filePreview.file)} />
            )}
            {filePreview.kind === "pdf" && filePreview.objectUrl && (
              <iframe className="pdfPreview" src={filePreview.objectUrl} title={getFileName(filePreview.file)} />
            )}
            {filePreview.kind === "text" && <pre className="textPreview">{filePreview.text}</pre>}
            {filePreview.kind === "details" && (
              <div className="detailsPreview">
                <IconFile kind={getFileKind(filePreview.file)} />
                <p>{filePreview.message}</p>
              </div>
            )}
            <div className="previewMeta">
              <span>{formatFileSize(filePreview.file.size)}</span>
              <span>{formatDate(getFileCreatedAt(filePreview.file))}</span>
              <span>{getFileMimeType(filePreview.file)}</span>
            </div>
            <div className="modalActions">
              <button className="ghostButton" type="button" onClick={() => void handleDownload(filePreview.file)}>
                Скачать
              </button>
              <button className="primaryButton" type="button" onClick={() => setFilePreview(null)}>
                Закрыть
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDialog && (
        <Modal title={confirmDialog.title} onClose={() => setConfirmDialog(null)}>
          <div className="confirmDialog">
            <p>{confirmDialog.body}</p>
            <div className="modalActions">
              <button className="ghostButton" type="button" onClick={() => setConfirmDialog(null)}>
                Отмена
              </button>
              <button className="dangerButton" type="button" disabled={pendingAction === "delete"} onClick={() => void handleConfirmDelete()}>
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modalOverlay" role="presentation" onMouseDown={onClose}>
      <section className="modalPanel" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header className="modalHeader">
          <h2>{title}</h2>
          <button type="button" aria-label="Закрыть" onClick={onClose}>
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
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

        setErrorMessage(error instanceof Error ? error.message : "Backend is not available");
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
            <p className="profileSubtitle">Сведения об аккаунте Tetra.</p>
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
                <strong>{formatDate(user.created_at)}</strong>
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
