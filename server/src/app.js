const express = require("express");
const cors = require("cors");

const prisma = require("./utils/prisma");
const authRoutes = require("./routes/authRoutes");
const deviceRoutes = require("./routes/deviceRoutes");
const recyclingRequestRoutes = require("./routes/recyclingRequestRoutes");
const organizationRoutes = require("./routes/organizationRoutes");
const userRoutes = require("./routes/userRoutes");
const pickupRoutes = require("./routes/pickupRoutes");
const ledgerRoutes = require("./routes/ledgerRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/pickups", pickupRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/recycling-requests", recyclingRequestRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/ledger", ledgerRoutes);

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
