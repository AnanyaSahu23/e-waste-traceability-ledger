const prisma = require("../utils/prisma");

const createOrganization = async (req, res) => {
  try {
    const {
      name,
      type,
      licenseNumber,
      contactEmail
    } = req.body;

    if (!name || !type || !licenseNumber || !contactEmail) {
      return res.status(400).json({
        error: "name, type, licenseNumber, and contactEmail are required"
      });
    }

    const organization = await prisma.organization.create({
      data: {
        name: name.trim(),
        type,
        licenseNumber: licenseNumber.trim(),
        contactEmail: contactEmail.trim().toLowerCase()
      }
    });

    return res.status(201).json({
      message: "Organization created successfully",
      organization
    });

  } catch (error) {
    console.error("Create organization error:", error);

    if (error.code === "P2002") {
      return res.status(409).json({
        error: "Organization with this unique value already exists"
      });
    }

    return res.status(500).json({
      error: "Unable to create organization"
    });
  }
};


const getAllOrganizations = async (req, res) => {
  try {
    const organizations = await prisma.organization.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });

    return res.json({
      organizations
    });

  } catch (error) {
    console.error("Get organizations error:", error);

    return res.status(500).json({
      error: "Unable to fetch organizations"
    });
  }
};


const getOrganizationById = async (req, res) => {
  try {
    const { id } = req.params;

    const organization = await prisma.organization.findUnique({
      where: {
        id
      }
    });

    if (!organization) {
      return res.status(404).json({
        error: "Organization not found"
      });
    }

    return res.json({
      organization
    });

  } catch (error) {
    console.error("Get organization error:", error);

    return res.status(500).json({
      error: "Unable to fetch organization"
    });
  }
};


module.exports = {
  createOrganization,
  getAllOrganizations,
  getOrganizationById
};