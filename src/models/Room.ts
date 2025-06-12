import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

interface RoomAttributes {
  id?: number;
  name: string;
  capacity: number;
  createdAt?: Date;
  updatedAt?: Date;
}

class Room extends Model<RoomAttributes> implements RoomAttributes {
  public id!: number;
  public name!: string;
  public capacity!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Room.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  capacity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 1000,
    },
  },
}, {
  sequelize,
  modelName: 'Room',
  tableName: 'Rooms',
});

export { Room };