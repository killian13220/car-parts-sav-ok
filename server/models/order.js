const mongoose = require('mongoose');

const orderEventSchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  type: { type: String, required: true },
  message: { type: String },
  payloadSnippet: { type: Object }
}, { _id: false });

const orderItemSchema = new mongoose.Schema({
  sku: String,
  name: String,
  qty: Number,
  unitPrice: Number
}, { _id: false });

const orderSchema = new mongoose.Schema({
  provider: { type: String, required: true, enum: ['woocommerce', 'mollie', 'bank_transfer', 'manual'] },
  providerOrderId: { type: String },
  number: { type: String },
  status: { type: String, required: true, enum: [
    'pending_payment', 'awaiting_transfer', 'paid', 'processing', 'fulfilled',
    'partially_fulfilled', 'cancelled', 'failed', 'refunded', 'disputed'
  ], default: 'pending_payment' },
  customer: {
    name: String,
    email: String,
    phone: String
  },
  totals: {
    currency: { type: String, default: 'EUR' },
    amount: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    tax: { type: Number, default: 0 }
  },
  items: [orderItemSchema],
  payment: {
    method: String,
    paidAt: Date,
    txId: String,
    // Mollie specifics
    molliePaymentId: { type: String, index: true, unique: false },
    mollieMode: String,
    mollieStatus: String
  },
  shipping: {
    address: Object,
    carrier: String,
    trackingNumber: String,
    shippedAt: Date
  },
  meta: {
    sourcePayloadHash: String,
    notes: [String]
  },
  events: [orderEventSchema]
}, { timestamps: true });

orderSchema.index({ provider: 1, providerOrderId: 1 }, { unique: true, sparse: true });
orderSchema.index({ 'payment.molliePaymentId': 1 }, { unique: true, sparse: true });
orderSchema.index({ status: 1, updatedAt: -1 });
orderSchema.index({ 'customer.email': 1 });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
