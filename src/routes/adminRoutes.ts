import express from 'express';
import { Op } from 'sequelize';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { User } from '../models/User';
import { Room } from '../models/Room';
import { Booking } from '../models/Booking';

const router = express.Router();

// Get all users
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'name', 'email', 'role', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'DESC']],
    });
    
    res.json(users);
  } catch (error: any) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all bookings
router.get('/bookings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, date } = req.query;
    
    let whereClause: any = {};
    
    if (status) {
      whereClause.status = status;
    }
    
    if (date) {
      const selectedDate = new Date(date as string);
      whereClause.startTime = {
        [Op.gte]: new Date(selectedDate.setHours(0, 0, 0, 0)),
        [Op.lt]: new Date(selectedDate.setHours(23, 59, 59, 999)),
      };
    }
    
    const bookings = await Booking.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email'],
        },
        {
          model: Room,
          as: 'room',
          attributes: ['roomId', 'name', 'capacity'],
        }
      ],
      order: [['startTime', 'ASC']],
    });
    
    res.json(bookings);
  } catch (error:any) {
    console.error('Admin bookings error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update booking status
router.patch('/bookings/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;
    
    const booking = await Booking.findByPk(id);
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    await booking.update({
      status,
      adminNotes: adminNotes || booking.adminNotes,
    });
    
    const updatedBooking = await Booking.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email'],
        },
        {
          model: Room,
          as: 'room',
          attributes: ['roomId', 'name', 'capacity'],
        }
      ],
    });
    
    res.json({
      message: 'Booking status updated successfully',
      booking: updatedBooking,
    });
  } catch (error:any) {
    console.error('Update booking status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Reschedule booking
router.patch('/bookings/:id/reschedule', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { startTime, endTime, adminNotes } = req.body;
    
    const booking = await Booking.findByPk(id);
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    // Check if new slot is available
    const existingBooking = await Booking.findOne({
      where: {
        id: { [Op.ne]: id },
        roomId: booking.roomId,
        status: {
          [Op.in]: ['approved', 'pending'],
        },
        [Op.or]: [
          {
            startTime: {
              [Op.between]: [new Date(startTime), new Date(endTime)]
            }
          },
          {
            endTime: {
              [Op.between]: [new Date(startTime), new Date(endTime)]
            }
          },
          {
            [Op.and]: [
              {
                startTime: {
                  [Op.lte]: new Date(startTime)
                }
              },
              {
                endTime: {
                  [Op.gte]: new Date(endTime)
                }
              }
            ]
          }
        ]
      },
    });
    
    if (existingBooking) {
      return res.status(400).json({ message: 'Time slot not available' });
    }
    
    await booking.update({
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      status: 'approved',
      adminNotes: adminNotes || booking.adminNotes,
    });
    
    const updatedBooking = await Booking.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email'],
        },
        {
          model: Room,
          as: 'room',
          attributes: ['roomId', 'name', 'capacity'],
        }
      ],
    });
    
    res.json({
      message: 'Booking rescheduled successfully',
      booking: updatedBooking,
    });
  } catch (error:any) {
    console.error('Reschedule booking error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get dashboard stats
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    
    const [totalBookings, pendingBookings, todayBookings, totalUsers] = await Promise.all([
      Booking.count(),
      Booking.count({ where: { status: 'pending' } }),
      Booking.count({
        where: {
          startTime: {
            [Op.gte]: startOfDay,
            [Op.lte]: endOfDay,
          },
        },
      }),
      User.count({ where: { role: 'user' } }),
    ]);
    
    res.json({
      totalBookings,
      pendingBookings,
      todayBookings,
      totalUsers,
    });
  } catch (error:any) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;  