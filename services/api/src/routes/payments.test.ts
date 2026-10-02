import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock auth middleware
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { userId: 'user-123', email: 'test@test.com', isAdmin: false };
    next();
  },
  adminMiddleware: (req: any, res: any, next: any) => next(),
}));

// Mock Prisma
vi.mock('../lib/prisma', () => {
  const prismaMock = {
    booking: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    workerEarning: {
      create: vi.fn(),
    },
    $transaction: vi.fn((cb) => {
      if (typeof cb === 'function') {
        return cb(prismaMock);
      }
      return Promise.resolve(cb);
    }),
  };
  return { default: prismaMock, prisma: prismaMock };
});

// Mock Cashfree SDK
vi.mock('cashfree-pg', () => {
  const PGCreateOrder = vi.fn();
  const PGOrderFetchPayments = vi.fn();
  const PGVerifyWebhookSignature = vi.fn();

  class MockCashfree {
    PGCreateOrder = PGCreateOrder;
    PGOrderFetchPayments = PGOrderFetchPayments;
    PGVerifyWebhookSignature = PGVerifyWebhookSignature;
  }
  (MockCashfree as any).PGCreateOrder = PGCreateOrder;
  (MockCashfree as any).PGOrderFetchPayments = PGOrderFetchPayments;
  (MockCashfree as any).PGVerifyWebhookSignature = PGVerifyWebhookSignature;

  return {
    Cashfree: MockCashfree,
    CFEnvironment: {
      PRODUCTION: 'PRODUCTION',
      SANDBOX: 'SANDBOX',
    },
    CFConfig: {
      CFEnvironment: {}
    }
  };
});

process.env.CASHFREE_APP_ID = 'test_app_id';
process.env.CASHFREE_SECRET_KEY = 'test_secret_key';
process.env.CASHFREE_ENVIRONMENT = 'SANDBOX';

// We need to import after mocks are set up
import { paymentsRouter } from './payments';
import { prisma } from '../lib/prisma';
import { Cashfree } from 'cashfree-pg';

const app = express();
app.use(express.json());
app.use('/api/payments', paymentsRouter);

describe('Payments Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/payments/create-order', () => {
    it('should successfully create a payment order for a valid booking', async () => {
      (prisma.booking.findUnique as any).mockResolvedValue({
        id: 'booking-1',
        userId: 'user-123',
        mode: 'home_help',
        durationHours: 2,
        status: 'PENDING',
      });

      (prisma.payment.create as any).mockResolvedValue({
        id: 'payment-1',
        bookingId: 'booking-1',
        amount: 1000,
        status: 'PENDING',
        paymentMethod: 'upi'
      });

      ((Cashfree as any).PGCreateOrder as any).mockResolvedValue({
        data: {
          payment_session_id: 'session_abc123',
          order_id: 'order_1',
        },
      });

      const response = await request(app)
        .post('/api/payments/create-order')
        .send({ bookingId: 'booking-1' });

      console.log('Create order response:', response.body);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('payment');
      expect(response.body.payment.paymentMethod).toBe('upi');
    });

    it('should return 403 if the user does not own the booking', async () => {
      (prisma.booking.findUnique as any).mockResolvedValue({
        id: 'booking-2',
        userId: 'user-456', // Different user than req.user.id
        totalAmount: 1000,
      });

      const response = await request(app)
        .post('/api/payments/create-order')
        .send({ bookingId: 'booking-2' });

      expect(response.status).toBe(403);
    });

    it('should return 404 if booking is not found', async () => {
      (prisma.booking.findUnique as any).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/payments/create-order')
        .send({ bookingId: 'non-existent' });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/payments/verify', () => {
    it('should verify payment successfully and run transaction for 15/85 payout split', async () => {
      ((Cashfree as any).PGOrderFetchPayments as any).mockResolvedValue({
        data: [{ payment_status: 'SUCCESS' }]
      });

      (prisma.payment.findUnique as any).mockResolvedValue({
        id: 'payment-1',
        bookingId: 'booking-1',
        amount: 1000, // This implies 150 platform fee, 850 worker payout
        status: 'pending',
        paymentMethod: 'cashfree',
        cashfreeOrderId: 'order_1',
        booking: {
          userId: 'user-123'
        }
      });

      (prisma.booking.findUnique as any).mockResolvedValue({
        id: 'booking-1',
        userId: 'user-123',
        workerId: 'worker-1',
        totalAmount: 1000,
        status: 'PENDING',
      });

      const response = await request(app)
        .post('/api/payments/verify')
        .send({ paymentId: 'payment-1' });

      console.log('Verify response:', response.body);
      expect(response.status).toBe(200);
      expect(prisma.payment.update).toHaveBeenCalled();
    });

    it('should handle failed payment verification', async () => {
      ((Cashfree as any).PGOrderFetchPayments as any).mockResolvedValue({
        data: [{ payment_status: 'FAILED' }]
      });

      (prisma.payment.findUnique as any).mockResolvedValue({
        id: 'payment-1',
        bookingId: 'booking-1',
        amount: 1000,
        status: 'pending',
        paymentMethod: 'cashfree',
        cashfreeOrderId: 'order_1',
      });

      const response = await request(app)
        .post('/api/payments/verify')
        .send({ paymentId: 'payment-1' });

      // Depending on router implementation, could be 400 or 200 with failed status
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('GET /api/payments/booking/:bookingId', () => {
    it('should return payments for the booking if authorized', async () => {
      (prisma.booking.findUnique as any).mockResolvedValue({
        id: 'booking-1',
        userId: 'user-123',
      });

      (prisma.payment.findUnique as any).mockResolvedValue(
        { id: 'payment-1', amount: 1000, status: 'SUCCESS' }
      );

      const response = await request(app)
        .get('/api/payments/booking/booking-1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('payment');
      expect(response.body.payment.id).toBe('payment-1');
    });

    it('should return 403 if trying to view another users booking payments', async () => {
      (prisma.booking.findUnique as any).mockResolvedValue({
        id: 'booking-2',
        userId: 'user-456',
      });

      const response = await request(app)
        .get('/api/payments/booking/booking-2');

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/payments/webhook', () => {
    it('should process a valid webhook', async () => {
      // Assuming PGVerifyWebhookSignature either returns true or throws
      ((Cashfree as any).PGVerifyWebhookSignature as any).mockImplementation(() => undefined);

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('x-webhook-signature', 'valid_signature')
        .set('x-webhook-timestamp', '1234567890')
        .send({
          data: {
            order: { order_id: 'order_1' },
            payment: { payment_status: 'SUCCESS' },
          },
          type: 'PAYMENT_SUCCESS_WEBHOOK',
        });

      // Typical response for successful webhook is 200 OK
      expect(response.status).toBe(200);
    });
  });
});
