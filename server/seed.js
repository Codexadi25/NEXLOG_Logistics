require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Order = require('./models/Order');
const Shipment = require('./models/Shipment');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/logistics_db';

const DEMO_USERS = [
  { name: 'Admin User', email: 'admin@nexlog.com', password: 'admin123', role: 'admin', company: 'NexLog HQ' },
  { name: 'Sarah Manager', email: 'manager@nexlog.com', password: 'manager123', role: 'manager', company: 'NexLog Ops' },
  { name: 'Alex Driver', email: 'driver@nexlog.com', password: 'driver123', role: 'driver', company: 'NexLog Fleet' },
  { name: 'Acme Corp', email: 'client@acme.com', password: 'client123', role: 'client', company: 'Acme Corporation' },
  { name: 'TechSupply Ltd', email: 'client2@techsupply.com', password: 'client123', role: 'client', company: 'TechSupply Ltd' },
];

const CITIES = [
  { city: 'New York', state: 'NY', country: 'US', postalCode: '10001', street: '123 Broadway' },
  { city: 'Los Angeles', state: 'CA', country: 'US', postalCode: '90001', street: '456 Sunset Blvd' },
  { city: 'Chicago', state: 'IL', country: 'US', postalCode: '60601', street: '789 Michigan Ave' },
  { city: 'Houston', state: 'TX', country: 'US', postalCode: '77001', street: '321 Main St' },
  { city: 'Phoenix', state: 'AZ', country: 'US', postalCode: '85001', street: '654 Desert Rd' },
  { city: 'Philadelphia', state: 'PA', country: 'US', postalCode: '19101', street: '987 Liberty Ave' },
];

const STATUSES = ['pending', 'confirmed', 'processing', 'in_transit', 'out_for_delivery', 'delivered'];
const PRIORITIES = ['low', 'normal', 'normal', 'high', 'urgent'];

const ITEMS_DATA = [
  { name: 'Industrial Printer', sku: 'PRN-001', weight: 12.5, description: 'Heavy-duty laser printer' },
  { name: 'Server Rack Unit', sku: 'SRV-002', weight: 45, description: '42U server rack' },
  { name: 'Medical Supplies Kit', sku: 'MED-003', weight: 3.2, description: 'First aid and medical equipment' },
  { name: 'Electronic Components', sku: 'ELC-004', weight: 0.8, description: 'Assorted PCB components' },
  { name: 'Office Furniture Set', sku: 'OFC-005', weight: 85, description: 'Ergonomic chair and desk' },
  { name: 'Chemical Reagents', sku: 'CHM-006', weight: 5.0, description: 'Lab-grade chemical supplies' },
  { name: 'Textile Rolls', sku: 'TEX-007', weight: 22, description: 'Industrial fabric rolls' },
  { name: 'Automotive Parts', sku: 'AUT-008', weight: 18.5, description: 'Engine and brake components' },
];

function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function daysAgo(n) { return new Date(Date.now() - n * 86400000); }
function daysFromNow(n) { return new Date(Date.now() + n * 86400000); }

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ MongoDB connected');

  // Clear
  await Promise.all([User.deleteMany({}), Order.deleteMany({}), Shipment.deleteMany({})]);
  console.log('🗑  Cleared existing data');

  // Create users
  const users = await User.create(DEMO_USERS);
  const admin = users.find(u => u.role === 'admin');
  const driver = users.find(u => u.role === 'driver');
  const clients = users.filter(u => u.role === 'client');
  console.log(`👤 Created ${users.length} users`);

  // Create orders
  const orders = [];
  for (let i = 0; i < 30; i++) {
    const client = rnd(clients);
    const status = rnd(STATUSES);
    const priority = rnd(PRIORITIES);
    const pickup = rnd(CITIES);
    const delivery = rnd(CITIES.filter(c => c.city !== pickup.city));
    const itemCount = Math.floor(Math.random() * 3) + 1;
    const items = Array.from({ length: itemCount }, () => {
      const item = rnd(ITEMS_DATA);
      return { ...item, quantity: Math.floor(Math.random() * 5) + 1, value: Math.floor(Math.random() * 500) + 50 };
    });
    const createdAt = daysAgo(Math.floor(Math.random() * 30));

    const order = new Order({
      client: client._id,
      assignedTo: status !== 'pending' ? driver._id : undefined,
      status,
      priority,
      items,
      pickupAddress: { ...pickup, company: client.company, contactName: client.name },
      deliveryAddress: { ...delivery, contactName: 'Receiving Dept' },
      scheduledPickup: daysAgo(Math.floor(Math.random() * 5)),
      scheduledDelivery: daysFromNow(Math.floor(Math.random() * 7)),
      actualPickup: ['in_transit', 'out_for_delivery', 'delivered'].includes(status) ? daysAgo(2) : undefined,
      actualDelivery: status === 'delivered' ? daysAgo(1) : undefined,
      shippingCost: Math.floor(Math.random() * 300) + 50,
      totalWeight: items.reduce((s, i) => s + (i.weight * i.quantity), 0),
      notes: Math.random() > 0.5 ? 'Handle with care. Fragile items inside.' : '',
    });
    order.createdAt = createdAt;
    await order.save();
    orders.push(order);
  }
  console.log(`📦 Created ${orders.length} orders`);

  // Create shipments
  const transitOrders = orders.filter(o => ['in_transit', 'out_for_delivery'].includes(o.status));
  const shipmentsData = [];

  for (let i = 0; i < 8; i++) {
    const batchOrders = transitOrders.slice(i * 2, i * 2 + 2);
    if (batchOrders.length === 0) break;

    const origin = rnd(CITIES);
    const destination = rnd(CITIES.filter(c => c.city !== origin.city));
    const shipStatus = rnd(['in_transit', 'out_for_delivery', 'scheduled', 'delivered']);

    const shipment = new Shipment({
      driver: driver._id,
      orders: batchOrders.map(o => o._id),
      status: shipStatus,
      vehicle: { type: rnd(['truck', 'van', 'motorcycle']), licensePlate: `NX-${Math.floor(Math.random() * 9000) + 1000}`, model: rnd(['Ford Transit', 'Mercedes Sprinter', 'Volvo FH']) },
      origin: { ...origin, coordinates: { lat: 40.7128 + Math.random() * 10 - 5, lng: -74.006 + Math.random() * 20 - 10 } },
      destination: { ...destination, coordinates: { lat: 34.0522 + Math.random() * 10 - 5, lng: -118.2437 + Math.random() * 20 - 10 } },
      currentLocation: { city: rnd(CITIES).city, state: rnd(CITIES).state, lastUpdated: daysAgo(0) },
      estimatedDelivery: daysFromNow(Math.floor(Math.random() * 5) + 1),
      actualDelivery: shipStatus === 'delivered' ? daysAgo(1) : undefined,
      priority: rnd(PRIORITIES),
      trackingEvents: [
        { status: 'scheduled', description: 'Shipment scheduled', timestamp: daysAgo(3) },
        { status: 'picked_up', description: `Picked up from ${origin.city}`, timestamp: daysAgo(2) },
        ...(shipStatus !== 'scheduled' ? [{ status: 'in_transit', description: `In transit via ${rnd(CITIES).city}`, timestamp: daysAgo(1) }] : []),
        ...(shipStatus === 'out_for_delivery' ? [{ status: 'out_for_delivery', description: `Out for delivery in ${destination.city}`, timestamp: new Date() }] : []),
        ...(shipStatus === 'delivered' ? [{ status: 'delivered', description: 'Delivered successfully', timestamp: daysAgo(1) }] : []),
      ],
    });

    await shipment.save();
    shipmentsData.push(shipment);

    // Link orders to shipment
    for (const order of batchOrders) {
      order.shipment = shipment._id;
      await order.save();
    }
  }

  console.log(`🚚 Created ${shipmentsData.length} shipments`);
  console.log('\n✅ Seed complete!\n');
  console.log('Demo accounts:');
  DEMO_USERS.forEach(u => console.log(`  ${u.role.padEnd(8)} — ${u.email} / ${u.password}`));

  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
