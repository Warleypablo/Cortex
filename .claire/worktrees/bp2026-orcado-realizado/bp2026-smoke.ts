import "dotenv/config";
import express from "express";
import { registerBp2026Routes } from "./server/routes/bp2026";
import { db } from "./server/db";
import { writeFileSync } from "fs";
const app = express();
registerBp2026Routes(app, db);
const server = app.listen(3992, async () => {
  const res = await fetch("http://localhost:3992/api/bp2026/receitas");
  const json: any = await res.json();
  delete json.atualizadoEm;
  writeFileSync(process.argv[2] ?? "/tmp/bp2026-payload.json", JSON.stringify(json, null, 1));
  console.log("payload salvo:", process.argv[2] ?? "/tmp/bp2026-payload.json", "linhas:", json.linhas.length);
  server.close(); process.exit(0);
});
