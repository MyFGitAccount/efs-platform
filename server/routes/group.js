//import express from 'express';
//import { ObjectId } from 'mongodb';
//import dotenv from 'dotenv';
//import nodemailer from 'nodemailer';
//import connectDB from '../db/connection.js';
const express = require('express');
const connectDB = require('../db/connection.js');
const nodemailer=require('nodemailer');
const {ObjectId}=require('mongodb');
//dotenv.config();

const router = express.Router();

// Create email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// Middleware to check authentication
const requireAuth = async (req, res, next) => {
  try {
    const sid = req.headers['x-sid'] || req.query.sid || req.body.sid;
    if (!sid) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }

    const db = await connectDB();
    const user = await db.collection('users').findOne({ sid });
    
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

// GET /api/group/requests - Get all group requests
router.get('/requests', async (req, res) => {
  try {
    const db = await connectDB();
    const requests = await db.collection('group_requests')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json({ ok: true, data: requests });
  } catch (err) {
    console.error('Get group requests error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/group/requests - Create group request
router.post('/requests', requireAuth, async (req, res) => {
  try {
    const { 
      description, 
      email, 
      phone, 
      major, 
      desired_groupmates, 
      gpa, 
      dse_score 
    } = req.body;
    
    if (!major) {
      return res.status(400).json({ ok: false, error: 'Major is required' });
    }
    
    const db = await connectDB();
    
    // Check if user already has an active request
    const existingRequest = await db.collection('group_requests').findOne({ 
      sid: req.user.sid 
    });
    
    if (existingRequest) {
      return res.status(409).json({ 
        ok: false, 
        error: 'You already have an active group request' 
      });
    }
    
    // Create group request
    const request = {
      sid: req.user.sid,
      description: description || '',
      email: email || req.user.email,
      phone: phone || req.user.phone || '',
      major: major.trim(),
      desired_groupmates: desired_groupmates || '',
      gpa: gpa ? parseFloat(gpa) : null,
      dse_score: dse_score || '',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const result = await db.collection('group_requests').insertOne(request);
    
    res.json({ 
      ok: true, 
      data: { _id: result.insertedId, ...request },
      message: 'Group request created successfully' 
    });
  } catch (err) {
    console.error('Create group request error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/group/requests/my - Get user's own requests
router.get('/requests/my', requireAuth, async (req, res) => {
  try {
    const db = await connectDB();
    const requests = await db.collection('group_requests')
      .find({ sid: req.user.sid })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json({ ok: true, data: requests });
  } catch (err) {
    console.error('Get my group requests error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/group/requests/:id/contact - Contact request creator
router.post('/requests/:id/contact', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const db = await connectDB();
    
    // Get the group request
    const request = await db.collection('group_requests').findOne({ 
      _id: new ObjectId(id) 
    });
    
    if (!request) {
      return res.status(404).json({ ok: false, error: 'Group request not found' });
    }
    
    // Don't allow contacting yourself
    if (request.sid === req.user.sid) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Cannot contact your own request' 
      });
    }
    
    // Get sender's profile
    const sender = req.user;
    
    // Format profile information
    const formatField = (label, value) => 
      value ? `• ${label}: ${value}\n` : '';
    
    const profileDetails = [
      formatField('Student ID', sender.sid),
      formatField('Email', sender.email),
      formatField('Major', sender.major),
      formatField('Year of Study', sender.year_of_study),
      formatField('GPA', sender.gpa),
      formatField('DSE Score', sender.dse_score),
      formatField('Skills', Array.isArray(sender.skills) ? sender.skills.join(', ') : sender.skills),
      formatField('Phone', sender.phone),
      formatField('About', sender.about_me),
    ].filter(Boolean).join('');
    
    // Send email
    const mailOptions = {
      from: `"EFS Learning Platform" <${process.env.GMAIL_USER}>`,
      to: request.email,
      subject: `New Group Invitation from ${sender.sid}`,
      text: `You've received a group invitation from ${sender.sid} on the EFS Learning Platform.\n\n` +
            `Message: ${message || 'No message provided.'}\n\n` +
            `Profile Details:\n${profileDetails}\n\n` +
            `You can reply directly to this email to contact ${sender.sid} at ${sender.email}.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>👋 New Group Invitation from ${sender.sid}</h2>
          
          ${message ? `
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="font-style: italic; margin: 0;">${message.replace(/\n/g, '<br>')}</p>
            </div>
          ` : ''}
          
          <h3>${sender.sid}'s Profile</h3>
          <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <pre style="white-space: pre-wrap; font-family: inherit; margin: 0;">${profileDetails}</pre>
          </div>
          
          <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #eee;">
            <p>You can contact ${sender.sid} directly at: <a href="mailto:${sender.email}">${sender.email}</a></p>
            ${sender.phone ? `<p>Phone: ${sender.phone}</p>` : ''}
          </div>
          
          <p style="color: #666; font-size: 0.9em; margin-top: 30px;">
            This message was sent through the EFS Learning Platform.
          </p>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    
    // Log the invitation
    await db.collection('group_invitations').insertOne({
      from_sid: sender.sid,
      to_sid: request.sid,
      request_id: new ObjectId(id),
      message: message || '',
      sent_at: new Date(),
      status: 'sent'
    });
    
    res.json({ 
      ok: true, 
      message: 'Invitation sent successfully' 
    });
  } catch (err) {
    console.error('Send invitation error:', err);
    res.status(500).json({ ok: false, error: 'Failed to send invitation' });
  }
});

// DELETE /api/group/requests/:id - Delete group request
router.delete('/requests/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await connectDB();
    
    // Find and delete request
    const result = await db.collection('group_requests').deleteOne({ 
      _id: new ObjectId(id),
      sid: req.user.sid // Only allow owner to delete
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Request not found or not authorized' 
      });
    }
    
    res.json({ ok: true, message: 'Group request deleted successfully' });
  } catch (err) {
    console.error('Delete group request error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// PUT /api/group/requests/:id - Update group request
router.put('/requests/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const db = await connectDB();
    
    // Remove fields that shouldn't be updated
    delete updates.sid;
    delete updates.createdAt;
    delete updates._id;
    
    // Update request
    const result = await db.collection('group_requests').updateOne(
      { 
        _id: new ObjectId(id),
        sid: req.user.sid // Only allow owner to update
      },
      { 
        $set: { 
          ...updates, 
          updatedAt: new Date() 
        } 
      }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Request not found or not authorized' 
      });
    }
    
    res.json({ ok: true, message: 'Group request updated successfully' });
  } catch (err) {
    console.error('Update group request error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/group/invitations/received - Get received invitations
router.get('/invitations/received', requireAuth, async (req, res) => {
  try {
    const db = await connectDB();
    const invitations = await db.collection('group_invitations')
      .find({ to_sid: req.user.sid })
      .sort({ sent_at: -1 })
      .toArray();
    
    res.json({ ok: true, data: invitations });
  } catch (err) {
    console.error('Get received invitations error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/group/invitations/sent - Get sent invitations
router.get('/invitations/sent', requireAuth, async (req, res) => {
  try {
    const db = await connectDB();
    const invitations = await db.collection('group_invitations')
      .find({ from_sid: req.user.sid })
      .sort({ sent_at: -1 })
      .toArray();
    
    res.json({ ok: true, data: invitations });
  } catch (err) {
    console.error('Get sent invitations error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/group/requests/search - Search group requests
router.post('/requests/search', async (req, res) => {
  try {
    const { query, major, minGpa } = req.body;
    const db = await connectDB();
    
    const searchFilter = { status: 'active' };
    
    if (query) {
      searchFilter.$or = [
        { description: { $regex: query, $options: 'i' } },
        { major: { $regex: query, $options: 'i' } },
        { desired_groupmates: { $regex: query, $options: 'i' } }
      ];
    }
    
    if (major) {
      searchFilter.major = { $regex: major, $options: 'i' };
    }
    
    if (minGpa) {
      searchFilter.gpa = { $gte: parseFloat(minGpa) };
    }
    
    const requests = await db.collection('group_requests')
      .find(searchFilter)
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json({ ok: true, data: requests });
  } catch (err) {
    console.error('Search group requests error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

module.exports = router;
//export default router;
