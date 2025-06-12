// src/routes/bookingRoutes.ts
import express from 'express';
import { Op } from 'sequelize';
import { authenticateToken } from '../middleware/auth';
import { Booking } from '../models/Bookings';
import { User } from '../models/User';
import { Room } from '../models/Room';

const router = express.Router();

// Get user's bookings
router.get('/my-bookings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    const bookings = await Booking.findAll({
      where: { userId },
      include: [
        {
          model: Room,
          attributes: ['id', 'name', 'capacity'],
        },
      ],
      order: [['startTime', 'DESC']],
    });
    
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Create new booking
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = <number> req.user?.id;
    const { roomId, title, description, startTime, endTime, participants } = req.body;
    
    // Validate input
    if (!roomId || !title || !startTime || !endTime || !participants) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    
    // Validate time
    if (start >= end) {
      return res.status(400).json({ message: 'End time must be after start time' });
    }

    if (start < new Date()) {
      return res.status(400).json({ message: 'Cannot book slots in the past' });
    }

    // Check if room exists
    const room = await Room.findByPk(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Check room capacity
    if (participants > room.capacity) {
      return res.status(400).json({ 
        message: `Room capacity is ${room.capacity}. Cannot book for ${participants} participants.` 
      });
    }

    // Check for conflicting bookings
    const conflictingBooking = await Booking.findOne({
      where: {
        roomId,
        status: {
          [Op.in]: ['approved', 'pending'],
        },
        [Op.or]: [
          {
            startTime: {
              [Op.lt]: end,
            },
            endTime: {
              [Op.gt]: start,
            },
          },
        ],
      },
    });

    if (conflictingBooking) {
      return res.status(400).json({ 
        message: 'Time slot conflicts with existing booking' 
      });
    }

    const booking = await Booking.create({
      userId,
      roomId,
      title,
      description,
      startTime: start,
      endTime: end,
      participants,
      status: 'pending',
    });

    const createdBooking = await Booking.findByPk(booking.id, {
      include: [
        {
          model: Room,
          attributes: ['id', 'name', 'capacity'],
        },
      ],
    });

    res.status(201).json({
      message: 'Booking created successfully',
      booking: createdBooking,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Cancel booking
router.patch('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    const booking = await Booking.findOne({
      where: { id, userId },
      include: [
        {
          model: Room,
          attributes: ['id', 'name', 'capacity'],
        },
      ],
    });
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ message: 'Booking is already cancelled' });
    }

    if (booking.startTime < new Date()) {
      return res.status(400).json({ message: 'Cannot cancel past bookings' });
    }

    await booking.update({ status: 'cancelled' });
    
    res.json({
      message: 'Booking cancelled successfully',
      booking,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Get booking details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    const whereClause: any = { id };
    
    // Regular users can only see their own bookings
    if (userRole !== 'admin') {
      whereClause.userId = userId;
    }
    
    const booking = await Booking.findOne({
      where: whereClause,
      include: [
        {
          model: Room,
          attributes: ['id', 'name', 'capacity'],
        },
        {
          model: User,
          attributes: ['id', 'name', 'email'],
        },
      ],
    });
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

export default router;