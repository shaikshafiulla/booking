import { User } from './User';
import { Room } from './Room';
import { Booking } from './Booking';

// Define all associations here
User.hasMany(Booking, { foreignKey: 'userId', as: 'bookings' });
Room.hasMany(Booking, { foreignKey: 'roomId', as: 'bookings' });

Booking.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Booking.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });

export { User, Room, Booking };