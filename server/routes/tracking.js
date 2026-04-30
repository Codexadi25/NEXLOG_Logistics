const express = require('express');
const router = express.Router();
const Shipment = require('../models/Shipment');

// Public tracking endpoint
router.get('/:trackingId', async (req, res) => {
  try {
    const queryId = req.params.trackingId.trim();
    
    // Check if it's an Order Number
    if (queryId.toUpperCase().startsWith('ORD-')) {
      const Order = require('../models/Order');
      const order = await Order.findOne({ orderNumber: queryId.toUpperCase() })
        .select('orderNumber status scheduledDelivery deliveryAddress pickupAddress priority createdAt');
        
      if (!order) return res.status(404).json({ message: 'Order not found' });
      
      const shipments = await Shipment.find({ orders: order._id })
        .populate('driver', 'name')
        .select('trackingNumber status currentLocation trackingEvents estimatedDelivery origin destination priority');
        
      return res.json({ type: 'order', order, shipments });
    }
    
    // Otherwise treat as Shipment Tracking Number
    const shipment = await Shipment.findOne({ trackingNumber: queryId.toUpperCase() })
      .populate('driver', 'name')
      .select('trackingNumber status currentLocation trackingEvents estimatedDelivery origin destination priority');
      
    if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
    
    res.json({ type: 'shipment', shipment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
