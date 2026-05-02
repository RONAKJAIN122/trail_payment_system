const Session = require('../models/Session');
const { nanoid } = require('nanoid');

// ─── POST /api/create-session ─────────────────────────────────────────────────
const createSession = async (req, res) => {
  try {
    const { totalAmount, numMembers } = req.body;

    // Validation
    if (!totalAmount || !numMembers) {
      return res.status(400).json({ success: false, message: 'Total amount and number of members are required.' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'QR code image is required.' });
    }

    const amount = parseFloat(totalAmount);
    const members = parseInt(numMembers, 10);

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid total amount.' });
    }
    if (isNaN(members) || members < 1) {
      return res.status(400).json({ success: false, message: 'Number of members must be at least 1.' });
    }

    const sessionId = nanoid(8).toUpperCase(); // e.g. "A3FX9KQ2"
    const amountPerMember = parseFloat((amount / members).toFixed(2));

    const session = await Session.create({
      sessionId,
      totalAmount: amount,
      numMembers: members,
      amountPerMember,
      qrCode: req.file.filename,
    });

    return res.status(201).json({
      success: true,
      message: 'Session created successfully.',
      data: session,
    });
  } catch (err) {
    console.error('createSession error:', err);
    return res.status(500).json({ success: false, message: 'Server error while creating session.' });
  }
};

// ─── POST /api/join-session ───────────────────────────────────────────────────
const joinSession = async (req, res) => {
  try {
    const { name, sessionId } = req.body;

    if (!name || !sessionId) {
      return res.status(400).json({ success: false, message: 'Name and Session ID are required.' });
    }

    const session = await Session.findOne({ sessionId: sessionId.toUpperCase() });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found. Check the Session ID.' });
    }

    // Check if member already joined
    const existing = session.members.find(
      (m) => m.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (existing) {
      // Return existing member data so they can continue
      return res.status(200).json({
        success: true,
        message: 'Welcome back!',
        data: { session, memberId: existing._id },
      });
    }

    // Check if session is full
    if (session.members.length >= session.numMembers) {
      return res.status(400).json({ success: false, message: 'This session is already full.' });
    }

    // Add new member
    session.members.push({
      name: name.trim(),
      amount: session.amountPerMember,
      status: 'Pending',
    });

    await session.save();

    const newMember = session.members[session.members.length - 1];

    return res.status(200).json({
      success: true,
      message: `Joined session successfully. You owe ₹${session.amountPerMember}`,
      data: { session, memberId: newMember._id },
    });
  } catch (err) {
    console.error('joinSession error:', err);
    return res.status(500).json({ success: false, message: 'Server error while joining session.' });
  }
};

// ─── GET /api/session/:id ─────────────────────────────────────────────────────
const getSession = async (req, res) => {
  try {
    const session = await Session.findOne({ sessionId: req.params.id.toUpperCase() });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }
    return res.status(200).json({ success: true, data: session });
  } catch (err) {
    console.error('getSession error:', err);
    return res.status(500).json({ success: false, message: 'Server error while fetching session.' });
  }
};

// ─── POST /api/update-payment ─────────────────────────────────────────────────
const updatePayment = async (req, res) => {
  try {
    const { sessionId, memberId, transactionId } = req.body;

    if (!sessionId || !memberId || !transactionId) {
      return res.status(400).json({ success: false, message: 'Session ID, Member ID, and Transaction ID are required.' });
    }

    const session = await Session.findOne({ sessionId: sessionId.toUpperCase() });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    const member = session.members.id(memberId);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found in this session.' });
    }

    if (member.status === 'Paid') {
      return res.status(400).json({ success: false, message: 'Payment already recorded for this member.' });
    }

    member.transactionId = transactionId.trim();
    member.status = 'Paid';

    await session.save();

    return res.status(200).json({
      success: true,
      message: 'Payment updated successfully!',
      data: session,
    });
  } catch (err) {
    console.error('updatePayment error:', err);
    return res.status(500).json({ success: false, message: 'Server error while updating payment.' });
  }
};

module.exports = { createSession, joinSession, getSession, updatePayment };
