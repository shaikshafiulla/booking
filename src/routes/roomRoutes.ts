// src/routes/roomRoutes.ts
import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { Room } from '../models/Room';
import { Booking } from '../models/Bookings';
import { Op } from 'sequelize';

const router = express.Router();

// Get all rooms (public - for users to see available rooms)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const rooms = await Room.findAll({
      order: [['name', 'ASC']],
    });
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Get room availability for a specific date
router.get('/:id/availability/:date', authenticateToken, async (req, res) => {
  try {
    const { id, date } = req.params;
    const selectedDate = new Date(date);
    const startOfDay = new Date(selectedDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(selectedDate.setHours(23, 59, 59, 999));

    const bookings = await Booking.findAll({
      where: {
        roomId: id,
        startTime: {
          [Op.gte]: startOfDay,
          [Op.lte]: endOfDay,
        },
        status: {
          [Op.in]: ['approved', 'pending'],
        },
      },
      order: [['startTime', 'ASC']],
    });

    res.json({ bookings });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Admin Routes - Room Management
// Create new room
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, capacity } = req.body;
    
    const existingRoom = await Room.findOne({ where: { name } });
    if (existingRoom) {
      return res.status(400).json({ message: 'Room with this name already exists' });
    }

    const room = await Room.create({ name, capacity });
    res.status(201).json({
      message: 'Room created successfully',
      room,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Update room
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, capacity } = req.body;
    
    const room = await Room.findByPk(id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Check if name is unique (excluding current room)
    if (name !== room.name) {
      const existingRoom = await Room.findOne({ 
        where: { 
          name,
          id: { [Op.ne]: id }
        } 
      });
      if (existingRoom) {
        return res.status(400).json({ message: 'Room with this name already exists' });
      }
    }

    await room.update({ name, capacity });
    res.json({
      message: 'Room updated successfully',
      room,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Delete room
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const room = await Room.findByPk(id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Check if room has any bookings
    const bookingCount = await Booking.count({ where: { roomId: id } });
    if (bookingCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete room with existing bookings. Please handle all bookings first.' 
      });
    }

    await room.destroy();
    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

export default router;