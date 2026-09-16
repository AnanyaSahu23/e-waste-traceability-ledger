const prisma = require("../utils/prisma");

const registerDevice = async (req, res) => {
  try {
    const {
      categoryId,
      ownerId,
      brand,
      model,
      serialNumber,
      manufactureYear
    } = req.body;

    // Basic validation
    if (!categoryId || !ownerId || !brand || !model) {
      return res.status(400).json({
        message: "categoryId, ownerId, brand, and model are required"
      });
    }

    const device = await prisma.device.create({
      data: {
        categoryId,
        ownerId,
        brand,
        model,
        serialNumber,
        manufactureYear
      }
    });

    res.status(201).json({
      message: "Device registered successfully",
      device
    });

  } catch (error) {
    console.error("Device registration error:", error);

    res.status(500).json({
      message: "Failed to register device"
    });
  }
};

module.exports = {
  registerDevice
};