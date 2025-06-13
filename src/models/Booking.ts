import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { User } from './User';
import { Room } from './Room';

interface BookingAttributes {
  id?: number;
  userId: number;
  roomId: number;
  startTime: Date;
  endTime: Date;
  purpose: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  adminNotes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class Booking extends Model<BookingAttributes> implements BookingAttributes {
  public id!: number;
  public userId!: number;
  public roomId!: number;
  public startTime!: Date;
  public endTime!: Date;
  public purpose!: string;
  public status!: 'pending' | 'approved' | 'rejected' | 'cancelled';
  public adminNotes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public readonly user?: User;
  public readonly room?: Room;
}

Booking.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  roomId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Room,
      key: 'roomId',
    },
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      isDate: true,
      isAfter: new Date().toISOString(),
    },
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      isDate: true,
      isAfterStartTime(value: Date) {
        if (value <= this.startTime) {
          throw new Error('End time must be after start time');
        }
      },
    },
  },
  purpose: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      len: [1, 500],
    },
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending',
  },
  adminNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  sequelize,
  modelName: 'Booking',
  tableName: 'Bookings',
  indexes: [
    {
      fields: ['startTime', 'endTime'],
    },
    {
      fields: ['userId'],
    },
    {
      fields: ['roomId'],
    },
    {
      fields: ['status'],
    },
  ],
});

export { Booking };