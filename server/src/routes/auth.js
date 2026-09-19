const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const prisma = require("../utils/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const publicUser = {
  id: true,
  name: true,
  email: true,
  phone: true,
  organizationId: true,
  createdAt: true,
};

function createToken(userId) {
  return jwt.sign({}, process.env.JWT_SECRET, {
    subject: userId,
    expiresIn: "1d",
  });
}

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!name || !normalizedEmail || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        error: "name, email, and a password of at least 8 characters are required",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name: name.trim(), email: normalizedEmail, passwordHash, phone },
      select: publicUser,
    });

    return res.status(201).json({ token: createToken(user.id), user });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Email is already registered" });
    }

    console.error(error);
    return res.status(500).json({ error: "Unable to register user" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const normalizedEmail = typeof req.body.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
    const { password } = req.body;

    if (!normalizedEmail || typeof password !== "string") {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    const passwordMatches = user && await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const { passwordHash, ...safeUser } = user;
    return res.json({ token: createToken(user.id), user: safeUser });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to log in" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: publicUser,
  });

  if (!user) {
    return res.status(401).json({ error: "User no longer exists" });
  }

  return res.json({ user });
});

module.exports = router;
