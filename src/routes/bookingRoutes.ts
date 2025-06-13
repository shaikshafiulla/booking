import express from 'express';
import { Op } from 'sequelize';
import { authenticateToken } from '../middleware/auth';
import { Room } from '../models/Room';
import { User } from '../models/User';
import { Booking } from '../models/Booking';

const router = express.Router();

// Get available rooms for a specific time slot
router.get('/available-rooms', authenticateToken, async (req, res) => {
  try {
    const { startTime, endTime } = req.query;

    if (!startTime || !endTime) {
      return res.status(400).json({ 
        message: 'Start time and end time are required' 
      });
    }

    const start = new Date(startTime as string);
    const end = new Date(endTime as string);

    // Validate dates
    if (start >= end) {
      return res.status(400).json({ 
        message: 'End time must be after start time' 
      });
    }

    if (start < new Date()) {
      return res.status(400).json({ 
        message: 'Start time cannot be in the past' 
      });
    }

    // Find all rooms
    const allRooms = await Room.findAll();

    // Find rooms that are already booked during the requested time
    const bookedRooms = await Booking.findAll({
      where: {
        status: {
          [Op.in]: ['approved', 'pending']
        },
        [Op.or]: [
          {
            startTime: {
              [Op.between]: [start, end]
            }
          },
          {
            endTime: {
              [Op.between]: [start, end]
            }
          },
          {
            [Op.and]: [
              {
                startTime: {
                  [Op.lte]: start
                }
              },
              {
                endTime: {
                  [Op.gte]: end
                }
              }
            ]
          }
        ]
      },
      include: [{
        model: Room,
        as: 'room'
      }]
    });

    const bookedRoomIds = bookedRooms.map(booking => booking.roomId);
    const availableRooms = allRooms.filter(room => !bookedRoomIds.includes(room.roomId));

    res.json({
      availableRooms,
      totalRooms: allRooms.length,
      availableCount: availableRooms.length,
      bookedCount: bookedRoomIds.length,
      requestedSlot: {
        startTime: start,
        endTime: end,
        duration: Math.round((end.getTime() - start.getTime()) / (1000 * 60)) // duration in minutes
      }
    });
  } catch (error) {
    console.error('Error fetching available rooms:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

// Create a new booking
router.post('/book', authenticateToken, async (req, res) => {
  try {
    const { roomId, startTime, endTime, purpose } = req.body;
    const userId = req.user!.id;

    // Validate required fields
    if (!roomId || !startTime || !endTime || !purpose) {
      return res.status(400).json({ 
        message: 'Room ID, start time, end time, and purpose are required' 
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    // Validate dates
    if (start >= end) {
      return res.status(400).json({ 
        message: 'End time must be after start time' 
      });
    }

    if (start < new Date()) {
      return res.status(400).json({ 
        message: 'Start time cannot be in the past' 
      });
    }

    // Check if room exists
    const room = await Room.findByPk(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Check if room is available during the requested time
    const conflictingBooking = await Booking.findOne({
      where: {
        roomId,
        status: {
          [Op.in]: ['approved', 'pending']
        },
        [Op.or]: [
          {
            startTime: {
              [Op.between]: [start, end]
            }
          },
          {
            endTime: {
              [Op.between]: [start, end]
            }
          },
          {
            [Op.and]: [
              {
                startTime: {
                  [Op.lte]: start
                }
              },
              {
                endTime: {
                  [Op.gte]: end
                }
              }
            ]
          }
        ]
      }
    });

    if (conflictingBooking) {
      return res.status(409).json({ 
        message: 'Room is not available during the requested time slot' 
      });
    }

    // Create the booking
    const booking = await Booking.create({
      userId,
      roomId,
      startTime: start,
      endTime: end,
      purpose,
      status: 'pending'
    });

    // Fetch the complete booking with associations
    const createdBooking = await Booking.findByPk(booking.id, {
      include: [
        {
          model: Room,
          as: 'room'
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    res.status(201).json({
      message: 'Booking created successfully',
      booking: createdBooking
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

// Get user's bookings
router.get('/my-bookings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { status, page = 1, limit = 10 } = req.query;

    const whereClause: any = { userId };
    
    if (status) {
      whereClause.status = status;
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { count, rows: bookings } = await Booking.findAndCountAll({
      where: whereClause,
      include: [{
        model: Room,
        as: 'room'
      }],
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset
    });

    res.json({
      bookings,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

// Cancel a booking
router.patch('/cancel/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const booking = await Booking.findOne({
      where: {
        id,
        userId
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ message: 'Booking is already cancelled' });
    }

    if (booking.status === 'rejected') {
      return res.status(400).json({ message: 'Cannot cancel a rejected booking' });
    }

    // Check if booking start time is in the past
    if (booking.startTime < new Date()) {
      return res.status(400).json({ 
        message: 'Cannot cancel a booking that has already started' 
      });
    }

    await booking.update({ status: 'cancelled' });

    const updatedBooking = await Booking.findByPk(id, {
      include: [{
        model: Room,
        as: 'room'
      }]
    });

    res.json({
      message: 'Booking cancelled successfully',
      booking: updatedBooking
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

// Get booking details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const booking = await Booking.findOne({
      where: {
        id,
        userId
      },
      include: [{
        model: Room,
        as: 'room'
      }]
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json({ booking });
  } catch (error) {
    console.error('Error fetching booking details:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

// Get all rooms
router.get('/rooms/all', authenticateToken, async (req, res) => {
  try {
    const rooms = await Room.findAll({
      order: [['name', 'ASC']]
    });

    res.json({ rooms });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

export default router;