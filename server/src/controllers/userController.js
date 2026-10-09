const prisma = require("../utils/prisma");

const assignOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.body;

    if (!organizationId) {
      return res.status(400).json({
        error: "organizationId is required"
      });
    }

    const organization = await prisma.organization.findUnique({
      where: {
        id: organizationId
      }
    });

    if (!organization) {
      return res.status(404).json({
        error: "Organization not found"
      });
    }

    const user = await prisma.user.update({
      where: {
        id
      },
      data: {
        organizationId
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        organizationId: true,
        organization: true
      }
    });

    return res.json({
      message: "User assigned to organization successfully",
      user
    });

  } catch (error) {
    console.error("Assign organization error:", error);

    if (error.code === "P2025") {
      return res.status(404).json({
        error: "User not found"
      });
    }

    return res.status(500).json({
      error: "Unable to assign organization"
    });
  }
};

module.exports = {
  assignOrganization
};