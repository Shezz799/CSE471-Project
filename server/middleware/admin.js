const { isDashboardAdminUser } = require("../utils/adminAccess");

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  return next();
};

/** Panel admins: role admin or ADMIN_PANEL_EMAILS */
const requireDashboardAdmin = (req, res, next) => {
  if (!req.user || !isDashboardAdminUser(req.user)) {
    return res.status(403).json({ success: false, message: "Admin dashboard access required" });
  }
  return next();
};

module.exports = requireAdmin;
module.exports.requireDashboardAdmin = requireDashboardAdmin;
