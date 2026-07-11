/**
 * Role-based access guard.
 * Usage: router.get('/path', auth, roles('admin'), controller)
 *        router.get('/path', auth, roles('admin', 'cashier'), controller)
 */
const roles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`,
      });
    }
    next();
  };
};

module.exports = roles;
