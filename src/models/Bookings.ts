import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { User } from './User';
import { Room } from './Room';

interface UpdatedBookingAttributes {
  id?: number;
  userId: number;
  roomId: number; // Add room reference
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  participants: number; // Add participant count
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  adminNotes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class Booking extends Model<UpdatedBookingAttributes> implements UpdatedBookingAttributes {
  public id!: number;
  public userId!: number;
  public roomId!: number;
  public title!: string;
  public description?: string;
  public startTime!: Date;
  public endTime!: Date;
  public participants!: number;
  public status!: 'pending' | 'approved' | 'rejected' | 'cancelled';
  public adminNotes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Update Booking model definition
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
      key: 'id',
    },
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  participants: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      min: 1,
    },
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending',
  },
  adminNotes: {
    type: DataTypes.TEXT,
  },
}, {
  sequelize,
  modelName: 'Booking',
});

// Associations
Room.hasMany(Booking, { foreignKey: 'roomId' });
Booking.belongsTo(Room, { foreignKey: 'roomId' });
User.hasMany(Booking, { foreignKey: 'userId' });
Booking.belongsTo(User, { foreignKey: 'userId' });

export {  Booking };
