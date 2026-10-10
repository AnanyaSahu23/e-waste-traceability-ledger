const { verifyDeviceLedger } = require("../utils/ledger");

const verifyLedger = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const result = await verifyDeviceLedger(
      require("../utils/prisma"),
      deviceId
    );

    if (!result.exists) {
      return res.status(404).json({
        message: "Device not found",
        ...result,
      });
    }

    return res.status(200).json({
      message: result.valid
        ? "Ledger chain verified successfully"
        : "Ledger verification failed",
      ...result,
    });
  } catch (error) {
    console.error("Ledger verification error:", error);

    return res.status(500).json({
      message: "Failed to verify ledger",
    });
  }
};

module.exports = { verifyLedger };