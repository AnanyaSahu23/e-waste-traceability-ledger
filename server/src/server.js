require("dotenv").config({path: "../.env",});
const path = require("path");

// require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be set to at least 32 characters");
}

const app = require("./app");

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

