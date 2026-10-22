const prisma = require("../utils/prisma");
const { createEventWithLedger } = require("../utils/ledger");

const uuidPattern =
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

const registerDevice = async (req, res) => {
  try {
    const {
      categoryId,
      brand,
      model,
      serialNumber,
      manufactureYear
    } = req.body;

    const ownerId = req.user.id;

    if (
      typeof categoryId !== "string" ||
      !uuidPattern.test(categoryId) ||
      !ownerId ||
      typeof brand !== "string" ||
      !brand.trim() ||
      typeof model !== "string" ||
      !model.trim()
    ) {
      return res.status(400).json({
        message: "categoryId, brand, and model are required"
      });
    }

    if (serialNumber !== undefined && typeof serialNumber !== "string") {
      return res.status(400).json({
        message: "serialNumber must be a string"
      });
    }

    if (
      manufactureYear !== undefined &&
      (!Number.isInteger(manufactureYear) ||
        manufactureYear < 1900 ||
        manufactureYear > new Date().getFullYear())
    ) {
      return res.status(400).json({
        message: "manufactureYear must be a valid year"
      });
    }

    const device = await prisma.$transaction(
      async (tx) => {
      const createdDevice = await tx.device.create({
        data: {
          categoryId,
          ownerId,
          brand: brand.trim(),
          model: model.trim(),
          serialNumber:
            typeof serialNumber === "string" && serialNumber.trim()
              ? serialNumber.trim()
              : null,
          manufactureYear
        }
      });

      await createEventWithLedger(tx, {
        deviceId: createdDevice.id,
        eventType: "REGISTERED",
        performedBy: ownerId,
        remarks: "Device registered"
      });

      return createdDevice;
    },
  {
    maxWait: 10000,
    timeout: 20000,
  }
);

    return res.status(201).json({
      message: "Device registered successfully",
      device
    });

  } catch (error) {
    console.error("Device registration error:", error);

    if (error.code === "P2003" || error.code === "P2025") {
      return res.status(400).json({
        message: "The device category or authenticated user no longer exists"
      });
    }

    return res.status(500).json({
      message: "Failed to register device"
    });
  }
};


const getAllDevices = async (req, res) => {
  try {
    const devices = await prisma.device.findMany({
      where: {
        ownerId: req.user.id
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