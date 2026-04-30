const express = require('express');
const Order = require('../models/Order');
const { auth, requireRole } = require('../middleware/auth');
const { notifyOrderUpdate } = require('../websocket/wsServer');

const router = express.Router();

// Get all orders (admin/manager sees all, client sees own)
router.get('/', auth, async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 20, search } = req.query;
    const query = {};

    if (req.user.role === 'client') query.client = req.user._id;
    if (req.user.role === 'driver') query.assignedTo = req.user._id;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'items.name': { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate('client', 'name email company')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ orders, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single order
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('client', 'name email company phone')
      .populate('assignedTo', 'name email phone')
      .populate('shipment');

    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Access control
    if (req.user.role === 'client' && order.client._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create order
router.post('/', auth, async (req, res) => {
  try {
    const { items, pickupAddress, deliveryAddress } = req.body;

    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required' });
    }
    const invalidItem = items.find(item => !item.name || !item.name.trim());
    if (invalidItem) {
      return res.status(400).json({ message: 'All items must have a name' });
    }

    // Validate pickup address
    if (!pickupAddress || !pickupAddress.street || !pickupAddress.city || !pickupAddress.state || !pickupAddress.postalCode) {
      return res.status(400).json({ message: 'Pickup address requires street, city, state, and postal code' });
    }

    // Validate delivery address
    if (!deliveryAddress || !deliveryAddress.street || !deliveryAddress.city || !deliveryAddress.state || !deliveryAddress.postalCode) {
      return res.status(400).json({ message: 'Delivery address requires street, city, state, and postal code' });
    }

    const orderData = {
      ...req.body,
      client: req.user.role === 'client' ? req.user._id : req.body.client || req.user._id,
    };
    const order = await Order.create(orderData);
    await order.populate('client', 'name email company');

    // Notify admins
    notifyOrderUpdate(req.user._id.toString(), order);

    res.status(201).json({ order });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ message: messages.join('. ') });
    }
    res.status(500).json({ message: err.message });
  }
});

// Update order
router.patch('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Clients can only update pending orders
    if (req.user.role === 'client') {
      if (order.client.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
      if (!['pending'].includes(order.status)) {
        return res.status(400).json({ message: 'Cannot modify order in current status' });
      }
    }

    const { status, ...updates } = req.body;

    // Handle status change
    if (status && status !== order.status) {
      order.statusHistory.push({
        status,
        updatedBy: req.user._id,
        note: req.body.statusNote || '',
      });
      order.status = status;

      if (status === 'delivered') order.actualDelivery = new Date();
      if (status === 'in_transit') order.actualPickup = order.actualPickup || new Date();
    }

    Object.assign(order, updates);
    await order.save();
    await order.populate('client', 'name email company');
    await order.populate('assignedTo', 'name email');

    // Notify via WebSocket
    notifyOrderUpdate(order.client._id?.toString() || order.client.toString(), order);

    res.json({ order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete order (admin only)
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ message: 'Order deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add item SVG image to order item
router.patch('/:orderId/items/:itemId/image', auth, async (req, res) => {
  try {
    const { svgImage } = req.body;
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const item = order.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    item.svgImage = svgImage;
    await order.save();
    res.json({ order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
