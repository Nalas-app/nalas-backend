require("dotenv").config();
require("./config/db");

const express = require("express");
const cors = require("cors");

const app = express();   // ✅ Create app FIRST

app.use(cors({
  origin: "http://localhost:3000",
}));

app.use(express.json());

const routes = require("./routes");

app.use("/api", routes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});