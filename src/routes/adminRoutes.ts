// routes/adminRoutes.ts
import express from 'express';
import { Op } from 'sequelize';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { Booking } from '../models/Bookings';
import { User } from '../models/User';

const router = express.Router();

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
      include: [{
        model: User,
        attributes: ['id', 'name', 'email'],
      }],
      order: [['startTime', 'ASC']],
    });
    
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
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
      include: [{
        model: User,
        attributes: ['id', 'name', 'email'],
      }],
    });
    
    res.json({
      message: 'Booking status updated successfully',
      booking: updatedBooking,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
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
        startTime: new Date(startTime),
        status: {
          [Op.in]: ['approved', 'pending'],
        },
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
      include: [{
        model: User,
        attributes: ['id', 'name', 'email'],
      }],
    });
    
    res.json({
      message: 'Booking rescheduled successfully',
      booking: updatedBooking,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
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
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

export default router;