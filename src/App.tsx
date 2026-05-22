import { useState, type FormEvent } from "react";
import { Link, Route, Routes } from "react-router-dom";
import "./App.css";

type AddUserResponse = {
  status: string;
  message: string;
};

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
          <Link to="/register">Попробовать</Link>
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
            <Link className="primaryButton" to="/register">
              Навести порядок
            </Link>

            <a className="ghostButton" href="#mess">
              Показать бардак
            </a>
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
        body: JSON.stringify({ name }),
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
    <main className="registerPage">
      <section className="registerCard">
        <p className="eyebrow">ранний доступ</p>

        <h1>Попробовать Tetra</h1>

        <p className="registerDescription">
          Сейчас это техническая форма ранней регистрации. Она уже проходит весь
          путь: frontend → backend → service → repository → database.
        </p>

        <form className="form" onSubmit={handleSubmit}>
          <label htmlFor="name">Имя</label>

          <input
            id="name"
            name="name"
            type="text"
            placeholder="Например, Sasha"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />

          <button type="submit" className="primaryButton">
            Зарегистрироваться
          </button>
        </form>

        {resultMessage && (
          <p className="successMessage">Готово: {resultMessage}</p>
        )}

        {errorMessage && <p className="errorMessage">Ошибка: {errorMessage}</p>}

        <Link className="backLink" to="/">
          Назад на главную
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