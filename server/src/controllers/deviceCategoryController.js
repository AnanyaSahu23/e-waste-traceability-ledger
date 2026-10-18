const prisma = require("../utils/prisma");

const getDeviceCategories = async (req, res) => {
  try {
    const categories = await prisma.deviceCategory.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return res.status(200).json({ categories });
  } catch (error) {
    console.error("Get device categories error:", error);

    return res.status(500).json({
      message: "Failed to fetch device categories",
    });
  }
};

module.exports = { getDeviceCategories };