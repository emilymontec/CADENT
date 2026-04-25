import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_, res) => {
  res.json("Cadent backend running...");
});

app.listen(4000, () => {
  console.log("Server → http://localhost:4000");
});
