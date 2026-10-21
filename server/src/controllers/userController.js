const assignOrganization = async (req, res) => {
  return res.status(403).json({
    error: "Organization membership is established during organization registration",
  });
};

module.exports = {
  assignOrganization
};