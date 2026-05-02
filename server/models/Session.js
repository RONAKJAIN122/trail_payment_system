const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Member name is required'],
    trim: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  transactionId: {
    type: String,
    default: '',
    trim: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Paid'],
    default: 'Pending',
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
});

const sessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [1, 'Amount must be at least 1'],
    },
    numMembers: {
      type: Number,
      required: [true, 'Number of members is required'],
      min: [1, 'At least 1 member is required'],
    },
    amountPerMember: {
      type: Number,
      required: true,
    },
    qrCode: {
      type: String, // filename of uploaded QR image
      required: [true, 'QR code image is required'],
    },
    members: {
      type: [memberSchema],
      default: [],
    },
    createdBy: {
      type: String,
      default: 'Organizer',
    },
  },
  { timestamps: true }
);

// Virtual: total collected
sessionSchema.virtual('totalCollected').get(function () {
  return this.members
    .filter((m) => m.status === 'Paid')
    .reduce((sum, m) => sum + m.amount, 0);
});

// Virtual: remaining
sessionSchema.virtual('remaining').get(function () {
  return this.totalAmount - this.totalCollected;
});

sessionSchema.set('toJSON', { virtuals: true });
sessionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Session', sessionSchema);
