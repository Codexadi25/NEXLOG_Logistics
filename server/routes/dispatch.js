const express = require('express');
const { auth, requireRole } = require('../middleware/auth');
const User = require('../models/User');
const Order = require('../models/Order');
const Shipment = require('../models/Shipment');

const router = express.Router();

// Get all drivers
router.get('/drivers', auth, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const drivers = await User.find({ role: 'driver' }).select('-password');
    res.json({ drivers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Onboard a new driver
router.post('/drivers', auth, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { name, email, password, assignedArea, vehicleType, vehicleCapacity, vehicleLicensePlate } = req.body;
    
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already in use' });

    const driver = new User({
      name, email, password, role: 'driver',
      assignedArea, vehicleType, vehicleCapacity, vehicleLicensePlate
    });
    
    await driver.save();
    
    res.status(201).json({ message: 'Driver onboarded successfully', driver: { _id: driver._id, name, email } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Auto-assign orders to drivers
router.post('/auto-assign', auth, requireRole('admin', 'manager'), async (req, res) => {
  try {
    // Find all pending, unassigned orders
    const orders = await Order.find({ status: 'pending', shipment: { $exists: false } }).populate('pickupAddress');
    
    if (orders.length === 0) return res.json({ message: 'No pending orders to assign.', assignedCount: 0 });

    const drivers = await User.find({ role: 'driver', isActive: true });
    if (drivers.length === 0) return res.status(400).json({ message: 'No active drivers available.' });

    let assignedCount = 0;
    
    for (const order of orders) {
      const orderCity = order.pickupAddress?.city || '';
      const orderWeight = order.totalWeight || 0;
      
      let selectedDriver = null;

      for (const d of drivers) {
        // Check Area
        const areaMatch = !d.assignedArea || 
                          d.assignedArea.toLowerCase() === orderCity.toLowerCase() || 
                          d.assignedArea.toLowerCase() === 'all';
                          
        if (!areaMatch) continue;

        // Check Capacity Limit
        // Find all currently active shipments for this driver
        const activeShipments = await Shipment.find({ 
          driver: d._id, 
          status: { $nin: ['delivered', 'failed', 'returned'] } 
        }).populate('orders');
        
        // Sum up the weight of all items in all active shipments
        let currentLoad = 0;
        for (const ship of activeShipments) {
          for (const o of ship.orders) {
            currentLoad += (o.totalWeight || 0);
          }
        }

        if (currentLoad + orderWeight <= (d.vehicleCapacity || 0)) {
          selectedDriver = d;
          break; // Found an available driver!
        }
      }

      if (selectedDriver) {
        // Create a shipment
        const shipment = new Shipment({
          orders: [order._id],
          driver: selectedDriver._id,
          vehicle: {
            type: selectedDriver.vehicleType,
            licensePlate: selectedDriver.vehicleLicensePlate
          },
          status: 'scheduled',
          origin: order.pickupAddress,
          destination: order.deliveryAddress,
          priority: order.priority
        });
        await shipment.save();

        order.shipment = shipment._id;
        order.status = 'processing';
        order.assignedTo = selectedDriver._id;
        order.statusHistory.push({
          status: 'processing',
          note: `Auto-assigned to driver ${selectedDriver.name} (Load +${orderWeight}kg)`,
          updatedBy: req.user._id
        });
        await order.save();
        assignedCount++;
      }
    }

    res.json({ message: `Auto-assigned ${assignedCount} orders.`, assignedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Manual assign
router.post('/manual-assign', auth, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { orderId, driverId } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    
    const driver = await User.findById(driverId);
    if (!driver || driver.role !== 'driver') return res.status(400).json({ message: 'Invalid driver' });

    const shipment = new Shipment({
      orders: [order._id],
      driver: driver._id,
      vehicle: {
        type: driver.vehicleType,
        licensePlate: driver.vehicleLicensePlate
      },
      status: 'scheduled',
      origin: order.pickupAddress,
      destination: order.deliveryAddress,
      priority: order.priority
    });
    await shipment.save();

    order.shipment = shipment._id;
    order.status = 'processing';
    order.assignedTo = driver._id;
    order.statusHistory.push({
      status: 'processing',
      note: `Manually assigned to driver ${driver.name}`,
      updatedBy: req.user._id
    });
    await order.save();

    res.json({ message: 'Order assigned successfully', shipment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
