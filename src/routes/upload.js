const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const fs = require("fs-extra");
const path = require("path");

const router = express.Router();

// Configuração de storage do multer
const uploadsDir = path.join(__dirname, "../../uploads");
const outputDir = path.join(__dirname, "../../output");

fs.ensureDirSync(uploadsDir);
fs.ensureDirSync(outputDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// Função auxiliar
function normalizarColunas(linha) {
  const nova = {};
  for (let chave in linha) {
    const chaveFormatada = chave.toLowerCase().trim();

    if (chaveFormatada.includes("código")) {
      nova["Código de Barras"] = linha[chave];
    } else if (chaveFormatada.includes("descrição") || chaveFormatada.includes("produto")) {
      nova["Descrição"] = linha[chave];
    } else if (chaveFormatada.includes("custo") || chaveFormatada.includes("valor")) {
      nova["Valor do Custo"] = linha[chave];
    }
  }
  return nova;
}

// Rota principal de upload
router.post("/", upload.array("files"), async (req, res) => {
  try {
    const files = req.files;
    let identificadores = req.body.identificadores;

    if (!Array.isArray(identificadores)) {
      identificadores = [identificadores];
    }

    const produtos = {};

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = identificadores[i] || `ID_${i + 1}`;
      const filePath = file.path;

      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      let data = XLSX.utils.sheet_to_json(sheet);

      data = data
        .map(normalizarColunas)
        .filter(row => {
          const custo = parseFloat(row["Valor do Custo"]);
          return row["Código de Barras"] && row["Descrição"] && !isNaN(custo);
        })
        .map(row => ({
          "Código de Barras": String(row["Código de Barras"]).trim(),
          "Descrição": row["Descrição"],
          "Valor do Custo": parseFloat(row["Valor do Custo"]),
          "Identificador": id
        }));

      for (const produto of data) {
        const codigo = produto["Código de Barras"];
        if (
          !produtos[codigo] ||
          produto["Valor do Custo"] < produtos[codigo]["Valor do Custo"]
        ) {
          produtos[codigo] = produto;
        }
      }
    }

    const resultado = Object.values(produtos);

    if (resultado.length === 0) {
      return res.status(400).send("Nenhum produto válido encontrado nos arquivos.");
    }

    const newSheet = XLSX.utils.json_to_sheet(resultado);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Menor Custo");

    const outputPath = path.join(outputDir, "resultado.xlsx");
    XLSX.writeFile(newWorkbook, outputPath);

    await fs.emptyDir(uploadsDir);

    res.download(outputPath, "resultado.xlsx", () => {
      fs.removeSync(outputPath);
    });
  } catch (err) {
    console.error("Erro no processamento:", err);
    res.status(500).send("Erro ao processar arquivos.");
  }
});

module.exports = router;
