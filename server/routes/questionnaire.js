import express from 'express';
import { ObjectId } from 'mongodb';
//import dotenv from 'dotenv';
import connectDB from '../db/connection.js';

//dotenv.config();

const router = express.Router();

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

// GET /api/questionnaire - Get all questionnaires
router.get('/', async (req, res) => {
  try {
    const db = await connectDB();
    const questionnaires = await db.collection('questionnaires')
      .find({ status: 'active' })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json({ ok: true, data: questionnaires });
  } catch (err) {
    console.error('Get questionnaires error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/questionnaire - Create new questionnaire
router.post('/', requireAuth, async (req, res) => {
  try {
    const { description, link, targetResponses = 30 } = req.body;
    
    if (!description || !link) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Description and link are required' 
      });
    }
    
    const db = await connectDB();
    
    // Check if user has enough credits (3 credits required)
    if (req.user.credits < 3) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Insufficient credits. Need 3 credits to post a questionnaire.' 
      });
    }
    
    // Check if user already has an active questionnaire
    const existingQuestionnaire = await db.collection('questionnaires').findOne({
      creatorSid: req.user.sid,
      status: 'active'
    });
    
    if (existingQuestionnaire) {
      return res.status(409).json({ 
        ok: false, 
        error: 'You already have an active questionnaire' 
      });
    }
    
    // Deduct 3 credits
    await db.collection('users').updateOne(
      { sid: req.user.sid },
      { $inc: { credits: -3 } }
    );
    
    // Create questionnaire
    const questionnaire = {
      creatorSid: req.user.sid,
      creatorEmail: req.user.email,
      description: description.trim(),
      link: link.trim(),
      targetResponses: parseInt(targetResponses),
      filledBy: [],
      currentResponses: 0,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const result = await db.collection('questionnaires').insertOne(questionnaire);
    
    res.json({ 
      ok: true, 
      data: { _id: result.insertedId, ...questionnaire },
      message: 'Questionnaire posted successfully. 3 credits deducted.' 
    });
  } catch (err) {
    console.error('Create questionnaire error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/questionnaire/:id/fill - Fill a questionnaire
router.post('/:id/fill', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await connectDB();
    
    // Get questionnaire
    const questionnaire = await db.collection('questionnaires').findOne({
      _id: new ObjectId(id),
      status: 'active'
    });
    
    if (!questionnaire) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Questionnaire not found or inactive' 
      });
    }
    
    // Check if user is the creator
    if (questionnaire.creatorSid === req.user.sid) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Cannot fill your own questionnaire' 
      });
    }
    
    // Check if already filled
    if (questionnaire.filledBy.includes(req.user.sid)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'You have already filled this questionnaire' 
      });
    }
    
    // Add user to filledBy and increment responses
    await db.collection('questionnaires').updateOne(
      { _id: new ObjectId(id) },
      { 
        $push: { filledBy: req.user.sid },
        $inc: { currentResponses: 1 },
        $set: { updatedAt: new Date() }
      }
    );
    
    // Give 1 credit to the filler
    await db.collection('users').updateOne(
      { sid: req.user.sid },
      { $inc: { credits: 1 } }
    );
    
    // Check if target reached
    const updatedQuestionnaire = await db.collection('questionnaires').findOne({
      _id: new ObjectId(id)
    });
    
    if (updatedQuestionnaire.currentResponses >= updatedQuestionnaire.targetResponses) {
      await db.collection('questionnaires').updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'completed', completedAt: new Date() } }
      );
    }
    
    res.json({ 
      ok: true, 
      message: 'Questionnaire filled successfully. You earned 1 credit!',
      data: { 
        credits: req.user.credits + 1,
        currentResponses: updatedQuestionnaire.currentResponses,
        targetResponses: updatedQuestionnaire.targetResponses
      }
    });
  } catch (err) {
    console.error('Fill questionnaire error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/questionnaire/my - Get user's questionnaires
router.get('/my', requireAuth, async (req, res) => {
  try {
    const db = await connectDB();
    
    const myQuestionnaires = await db.collection('questionnaires')
      .find({ creatorSid: req.user.sid })
      .sort({ createdAt: -1 })
      .toArray();
    
    const filledQuestionnaires = await db.collection('questionnaires')
      .find({ filledBy: req.user.sid })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json({ 
      ok: true, 
      data: {
        created: myQuestionnaires,
        filled: filledQuestionnaires.map(q => q._id)
      }
    });
  } catch (err) {
    console.error('Get my questionnaires error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/questionnaire/stats - Get questionnaire statistics
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const db = await connectDB();
    
    const [
      totalQuestionnaires,
      activeQuestionnaires,
      completedQuestionnaires,
      totalResponses,
      myQuestionnaires,
      myResponses,
      availableToFill
    ] = await Promise.all([
      db.collection('questionnaires').countDocuments(),
      db.collection('questionnaires').countDocuments({ status: 'active' }),
      db.collection('questionnaires').countDocuments({ status: 'completed' }),
      db.collection('questionnaires').aggregate([
        { $group: { _id: null, total: { $sum: '$currentResponses' } } }
      ]).toArray(),
      db.collection('questionnaires').find({ creatorSid: req.user.sid }).toArray(),
      db.collection('questionnaires').countDocuments({ filledBy: req.user.sid }),
      // Questionnaires user hasn't filled yet
      db.collection('questionnaires').countDocuments({ 
        status: 'active',
        creatorSid: { $ne: req.user.sid },
        filledBy: { $ne: req.user.sid }
      })
    ]);
    
    const myTotalResponses = myQuestionnaires.reduce((sum, q) => sum + q.currentResponses, 0);
    const myTotalTarget = myQuestionnaires.reduce((sum, q) => sum + q.targetResponses, 0);
    
    res.json({
      ok: true,
      data: {
        platform: {
          totalQuestionnaires,
          activeQuestionnaires,
          completedQuestionnaires,
          totalResponses: totalResponses[0]?.total || 0,
        },
        personal: {
          questionnairesCreated: myQuestionnaires.length,
          questionnairesFilled: myResponses,
          totalResponsesReceived: myTotalResponses,
          responseRate: myTotalTarget > 0 ? (myTotalResponses / myTotalTarget * 100).toFixed(1) : 0,
          availableToFill,
          credits: req.user.credits,
        }
      }
    });
  } catch (err) {
    console.error('Get questionnaire stats error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// DELETE /api/questionnaire/:id - Delete questionnaire
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await connectDB();
    
    // Find questionnaire
    const questionnaire = await db.collection('questionnaires').findOne({
      _id: new ObjectId(id)
    });
    
    if (!questionnaire) {
      return res.status(404).json({ ok: false, error: 'Questionnaire not found' });
    }
    
    // Check if user is the creator
    if (questionnaire.creatorSid !== req.user.sid && req.user.role !== 'admin') {
      return res.status(403).json({ 
        ok: false, 
        error: 'Not authorized to delete this questionnaire' 
      });
    }
    
    // Delete questionnaire
    await db.collection('questionnaires').deleteOne({ _id: new ObjectId(id) });
    
    // Refund credits if questionnaire was active and had less than 5 responses
    if (questionnaire.status === 'active' && questionnaire.currentResponses < 5) {
      await db.collection('users').updateOne(
        { sid: req.user.sid },
        { $inc: { credits: 3 } }
      );
      
      res.json({ 
        ok: true, 
        message: 'Questionnaire deleted. 3 credits refunded.' 
      });
    } else {
      res.json({ 
        ok: true, 
        message: 'Questionnaire deleted successfully' 
      });
    }
  } catch (err) {
    console.error('Delete questionnaire error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// PUT /api/questionnaire/:id - Update questionnaire
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { description, link, targetResponses } = req.body;
    const db = await connectDB();
    
    // Find questionnaire
    const questionnaire = await db.collection('questionnaires').findOne({
      _id: new ObjectId(id)
    });
    
    if (!questionnaire) {
      return res.status(404).json({ ok: false, error: 'Questionnaire not found' });
    }
    
    // Check if user is the creator
    if (questionnaire.creatorSid !== req.user.sid) {
      return res.status(403).json({ 
        ok: false, 
        error: 'Not authorized to update this questionnaire' 
      });
    }
    
    const updates = {};
    if (description) updates.description = description;
    if (link) updates.link = link;
    if (targetResponses) updates.targetResponses = parseInt(targetResponses);
    updates.updatedAt = new Date();
    
    await db.collection('questionnaires').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );
    
    res.json({ 
      ok: true, 
      message: 'Questionnaire updated successfully' 
    });
  } catch (err) {
    console.error('Update questionnaire error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/questionnaire/fillable - Get questionnaires available to fill
router.get('/fillable', requireAuth, async (req, res) => {
  try {
    const db = await connectDB();
    
    const fillableQuestionnaires = await db.collection('questionnaires')
      .find({ 
        status: 'active',
        creatorSid: { $ne: req.user.sid },
        filledBy: { $ne: req.user.sid }
      })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json({ ok: true, data: fillableQuestionnaires });
  } catch (err) {
    console.error('Get fillable questionnaires error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

export default router;
