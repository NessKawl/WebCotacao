const express = require("express");
const path = require("path");
const { exec } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

// Public
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

// Rotas
const uploadRouter = require("./routes/upload");
app.use("/upload", uploadRouter);

// Página inicial
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Inicia servidor
app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Servidor rodando em ${url}`);

  switch (process.platform) {
    case "win32":
      exec(`start ${url}`);
      break;
    case "darwin":
      exec(`open ${url}`);
      break;
    case "linux":
      exec(`xdg-open ${url}`);
      break;
  }
});
