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


const getAllDevices = async (req, res) => {
  try {
    const devices = await prisma.device.findMany({
      include: {
  category: true,
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      organizationId: true
    }
  }
},
      orderBy: {
        createdAt: "desc"
      }
    });

    res.status(200).json({
      devices
    });

  } catch (error) {
    console.error("Get devices error:", error);

    res.status(500).json({
      message: "Failed to fetch devices"
    });
  }
};


const getDeviceById = async (req, res) => {
  try {
    const { id } = req.params;

    const device = await prisma.device.findUnique({
      where: {
        id
      },
      include: {
  category: true,
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      organizationId: true
    }
  }
}
    });

    if (!device) {
      return res.status(404).json({
        message: "Device not found"
      });
    }

    res.status(200).json({
      device
    });

  } catch (error) {
    console.error("Get device error:", error);

    res.status(500).json({
      message: "Failed to fetch device"
    });
  }
};

module.exports = {
  registerDevice,
  getAllDevices,
  getDeviceById
};