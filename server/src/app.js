const express = require("express");
const cors = require("cors");

const prisma = require("./utils/prisma");
const authRoutes = require("./routes/auth");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "E-Waste Traceability API is running",
  });
});

app.get("/api/test-db", async (req, res) => {
  try {
    const result = await prisma.$queryRaw`SELECT NOW()`;

    res.json({
      status: "ok",
      database: "connected",
      time: result[0].now,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      status: "error",
      database: "connection failed",
    });
  }
});


module.exports = app;
