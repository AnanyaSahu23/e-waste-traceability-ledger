const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const prisma = require("../utils/prisma");

const publicUser = {
  id: true,
  name: true,
  email: true,
  phone: true,
  organizationId: true,
  organization: {
    select: {
      id: true,
      name: true,
      type: true,
      licenseNumber: true,
      contactEmail: true,
    },
  },
  createdAt: true,
};

function createToken(userId) {
  return jwt.sign({}, process.env.JWT_SECRET, {
    subject: userId,
    expiresIn: "1d",
  });
}

const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    const normalizedEmail =
      typeof email === "string"
        ? email.trim().toLowerCase()
        : "";

    if (
      !name ||
      !normalizedEmail ||
      typeof password !== "string" ||
      password.length < 8
    ) {
      return res.status(400).json({
        error:
          "name, email, and a password of at least 8 characters are required",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        phone,
      },
      select: publicUser,
    });

    return res.status(201).json({
      token: createToken(user.id),
      user,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        error: "Email is already registered",
      });
    }

    console.error("Registration error:", error);

    return res.status(500).json({
      error: "Unable to register user",
    });
  }
};

const registerOrganization = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      organizationName,
      organizationType,
      licenseNumber,
      contactEmail,
    } = req.body || {};

    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedContactEmail =
      typeof contactEmail === "string" ? contactEmail.trim().toLowerCase() : "";
    const normalizedName = typeof name === "string" ? name.trim() : "";
    const normalizedOrganizationName =
      typeof organizationName === "string" ? organizationName.trim() : "";
    const normalizedLicense =
      typeof licenseNumber === "string" ? licenseNumber.trim() : "";
    const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    const organizationTypes = [
      "COLLECTION_CENTER",
      "TRANSPORT_COMPANY",
      "RECYCLING_FACILITY",
    ];

    if (
      !normalizedName ||
      !validEmail(normalizedEmail) ||
      typeof password !== "string" ||
      password.length < 8 ||
      !normalizedOrganizationName ||
      !organizationTypes.includes(organizationType) ||
      !normalizedLicense ||
      !validEmail(normalizedContactEmail)
    ) {
      return res.status(400).json({
        error:
          "Valid account details, organization name, type, license number, and contact email are required; password must be at least 8 characters",
      });
    }
    if (phone !== undefined && typeof phone !== "string") {
      return res.status(400).json({ error: "phone must be a string" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: normalizedOrganizationName,
          type: organizationType,
          licenseNumber: normalizedLicense,
          contactEmail: normalizedContactEmail,
        },
      });
      return tx.user.create({
        data: {
          name: normalizedName,
          email: normalizedEmail,
          passwordHash,
          phone: typeof phone === "string" && phone.trim() ? phone.trim() : null,
          organizationId: organization.id,
        },
        select: publicUser,
      });
    }, {
      maxWait: 15000,
      timeout: 20000,
    });

    return res.status(201).json({
      message: "Organization account created successfully",
      token: createToken(user.id),
      user,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        error: "An account with this email is already registered",
      });
    }
    if (error.code === "P2028") {
      console.error("Organization registration transaction timed out:", error);
      return res.status(503).json({
        error: "The database is taking too long to respond. Please retry organization signup.",
      });
    }
    console.error("Organization registration error:", error);
    return res.status(500).json({
      error: "Unable to create organization account",
    });
  }
};

const login = async (req, res) => {
  try {
    const normalizedEmail =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    const { password } = req.body;

    if (!normalizedEmail || typeof password !== "string") {
      return res.status(400).json({
        error: "email and password are required",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    const passwordMatches =
      user && (await bcrypt.compare(password, user.passwordHash));

    if (!passwordMatches) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }


    const safeUser = await prisma.user.findUnique({
      where: {
        id: user.id,
      },
      select: publicUser,
    });
    
    return res.json({
      token: createToken(user.id),
      user: safeUser,
    });

} catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      error: "Unable to log in",
    });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id,
      },
      select: publicUser,
    });

    if (!user) {
      return res.status(401).json({
        error: "User no longer exists",
      });
    }

    return res.json({
      user,
    });
  } catch (error) {
    console.error("Get current user error:", error);

    return res.status(500).json({
      error: "Unable to fetch user",
    });
  }
};

module.exports = {
  register,
  registerOrganization,
  login,
  getMe,
};