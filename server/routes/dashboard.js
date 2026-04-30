const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Shipment = require('../models/Shipment');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

router.get('/stats', auth, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const clientFilter = req.user.role === 'client' ? { client: req.user._id } : {};
    const driverFilter = req.user.role === 'driver' ? { assignedTo: req.user._id } : {};
    const baseFilter = { ...clientFilter, ...driverFilter };

    const [
      totalOrders, pendingOrders, inTransitOrders, deliveredOrders,
      ordersThisMonth, ordersLastMonth,
      activeShipments, totalShipments,
      recentOrders, recentShipments,
    ] = await Promise.all([
      Order.countDocuments(baseFilter),
      Order.countDocuments({ ...baseFilter, status: 'pending' }),
      Order.countDocuments({ ...baseFilter, status: { $in: ['in_transit', 'out_for_delivery', 'processing'] } }),
      Order.countDocuments({ ...baseFilter, status: 'delivered' }),
      Order.countDocuments({ ...baseFilter, createdAt: { $gte: startOfMonth } }),
      Order.countDocuments({ ...baseFilter, createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } }),
      Shipment.countDocuments({ status: { $in: ['in_transit', 'out_for_delivery'] } }),
      Shipment.countDocuments({}),
      Order.find(baseFilter).sort({ createdAt: -1 }).limit(5)
        .populate('client', 'name company'),
      Shipment.find({}).sort({ createdAt: -1 }).limit(5)
        .populate('driver', 'name'),
    ]);

    // Order status breakdown
    const statusBreakdown = await Order.aggregate([
      { $match: baseFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Monthly order trend (last 6 months)
    const monthlyTrend = await Order.aggregate([
      {
        $match: {
          ...baseFilter,
          createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) },
        },
      },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
          revenue: { $sum: '$shippingCost' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const growth = ordersLastMonth === 0 ? 100 :
      Math.round(((ordersThisMonth - ordersLastMonth) / ordersLastMonth) * 100);

    res.json({
      stats: {
        totalOrders, pendingOrders, inTransitOrders, deliveredOrders,
        ordersThisMonth, ordersLastMonth, growth,
        activeShipments, totalShipments,
      },
      statusBreakdown: statusBreakdown.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      monthlyTrend,
      recentOrders,
      recentShipments,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
