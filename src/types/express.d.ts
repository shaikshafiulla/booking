import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: 'admin' | 'user';
        iat?: number;
        exp?: number;
      };
    }
  }
}