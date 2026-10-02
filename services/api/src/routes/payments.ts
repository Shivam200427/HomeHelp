import { Router, Request } from 'express';
import { Cashfree, CFEnvironment } from 'cashfree-pg';
import { prisma } from '../lib/prisma';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { RATE_TABLE } from '../lib/constants';

export const paymentsRouter = Router();

const cashfreeEnv = process.env.CASHFREE_ENVIRONMENT === 'PRODUCTION' 
  ? CFEnvironment.PRODUCTION 
  : CFEnvironment.SANDBOX;

const cashfreeAppId = process.env.CASHFREE_APP_ID || '';
const cashfreeSecretKey = process.env.CASHFREE_SECRET_KEY || '';
const hasCashfreeKeys = !!(cashfreeAppId && cashfreeSecretKey);

let cashfree: Cashfree | null = null;
if (hasCashfreeKeys) {
  cashfree = new Cashfree(cashfreeEnv, cashfreeAppId, cashfreeSecretKey);
}

const upiVpa = process.env.UPI_VPA || '';
const upiName = process.env.UPI_NAME || 'HomeHelp';

function buildUpiLink(bookingId: string, amount: number): string | null {
  if (!upiVpa) return null;
  const note = `HomeHelp Booking ${bookingId.slice(0, 8)}`;
  const params = new URLSearchParams({
    pa: upiVpa,
    pn: upiName,
    am: amount.toFixed(2),
    cu: 'INR',
    tn: note,
  });
  return `upi://pay?${params.toString()}`;
}

function computeWorkerPayout(amount: number): number {
  const platformFee = parseFloat((amount * 0.15).toFixed(2));
  return parseFloat((amount - platformFee).toFixed(2));
}

// Webhook endpoint (unauthenticated, requires raw signature)
paymentsRouter.post('/webhook', async (req: Request & { rawBody?: string }, res) => {
  try {
    const signature = req.headers['x-webhook-signature'] as string;
    const timestamp = req.headers['x-webhook-timestamp'] as string;
    const rawBody = req.rawBody || JSON.stringify(req.body);

    if (!cashfree) {
       return res.status(400).json({ error: 'Cashfree not configured' });
    }

    try {
      cashfree.PGVerifyWebhookSignature(signature, rawBody, timestamp);
    } catch (err) {
      console.error('[Payments] Webhook signature invalid', err);
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    if (payload.type === 'PAYMENT_SUCCESS_WEBHOOK') {
      const orderId = payload.data?.order?.order_id;
      if (!orderId) return res.status(400).json({ error: 'Missing order_id' });

      const payment = await prisma.payment.findFirst({
        where: { cashfreeOrderId: orderId }
      });

      if (payment && (payment.status === 'pending' || payment.status === 'captured')) {
         const recomputed = computeWorkerPayout(Number(payment.amount));
         await prisma.payment.update({
           where: { id: payment.id },
           data: { status: 'paid', workerPayout: recomputed }
         });
         console.log(`[Payments] Webhook processed. Payment ${payment.id} marked as PAID.`);
      }
    }
    
    return res.status(200).json({ status: 'OK' });
  } catch (err) {
    console.error('[Payments] Webhook processing error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

paymentsRouter.use(authMiddleware);

paymentsRouter.post('/create-order', async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ error: 'bookingId is required' });
    }

    const booking = await prisma.booking.findUnique({ 
      where: { id: bookingId },
      include: { user: true } 
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (booking.userId !== req.user!.userId) {
      return res.status(403).json({ error: 'You can only create payments for your own bookings' });
    }

    const defaultRate = booking.mode && RATE_TABLE[booking.mode] ? RATE_TABLE[booking.mode] : 0;
    const rate = booking.hourlyRate ? Number(booking.hourlyRate) : defaultRate;
    const hours = booking.durationHours ? Number(booking.durationHours) : 1;
    const amount = parseFloat((rate * hours).toFixed(2));

    if (amount <= 0) {
      return res.status(400).json({ error: 'Cannot create payment: booking has no valid rate or duration' });
    }

    const platformFee = parseFloat((amount * 0.15).toFixed(2));
    const workerPayout = computeWorkerPayout(amount);

    let payment = await prisma.payment.findUnique({ where: { bookingId } });

    if (payment && (payment.status === 'paid' || payment.status === 'captured')) {
      return res.status(409).json({ error: 'Payment already completed for this booking', payment });
    }

    let cashfreeOrderId: string | null = null;
    let cashfreeSessionId: string | null = null;
    let method = 'upi';

    if (!payment) {
      if (cashfree) {
        try {
          const generatedOrderId = `booking_${bookingId.replace(/-/g, '').slice(0, 15)}_${Date.now()}`;
          const response = await cashfree.PGCreateOrder({
            order_id: generatedOrderId,
            order_amount: amount,
            order_currency: "INR",
            customer_details: {
              customer_id: req.user!.userId.replace(/-/g, '').slice(0, 20),
              customer_phone: booking.user?.phoneNumber || "9999999999",
              customer_email: booking.user?.email || "customer@homehelp.local",
            },
            order_meta: {
              return_url: `${process.env.FRONTEND_URL || 'https://homehelp-website.vercel.app'}/my-bookings?order_id={order_id}`,
              notify_url: `${process.env.NEXT_PUBLIC_API_URL || 'https://homehelp-clbc.onrender.com'}/api/payments/webhook`
            }
          });
          cashfreeOrderId = response.data.order_id || null;
          cashfreeSessionId = response.data.payment_session_id || null;
          method = 'cashfree';
        } catch (err: any) {
          console.error('[Payments] Cashfree order creation failed:', err.response?.data || err);
          throw new Error('Cashfree order creation failed');
        }
      } else {
        console.warn('[Payments] Cashfree not configured - using UPI manual collection');
        cashfreeOrderId = null;
        cashfreeSessionId = null;
        method = 'upi';
      }

      payment = await prisma.payment.create({
        data: {
          bookingId,
          amount: Number(amount),
          platformFee,
          workerPayout,
          status: 'pending',
          paymentMethod: method,
          cashfreeOrderId,
          cashfreeSessionId
        },
      });
    } else if (
      payment.paymentMethod === 'cashfree' &&
      cashfree &&
      !payment.cashfreeOrderId &&
      payment.status === 'pending'
    ) {
      const generatedOrderId = `booking_${bookingId.replace(/-/g, '').slice(0, 15)}_${Date.now()}`;
      const response = await cashfree.PGCreateOrder({
        order_id: generatedOrderId,
        order_amount: Math.round(Number(payment.amount)),
        order_currency: "INR",
        customer_details: {
          customer_id: req.user!.userId.replace(/-/g, '').slice(0, 20),
          customer_phone: booking.user?.phoneNumber || "9999999999",
          customer_email: booking.user?.email || "customer@homehelp.local",
        }
      });
      payment = await prisma.payment.update({
        where: { id: payment.id },
        data: { 
          cashfreeOrderId: response.data.order_id || null, 
          cashfreeSessionId: response.data.payment_session_id || null 
        },
      });
    }

    const upiLink = payment.paymentMethod === 'upi' ? buildUpiLink(bookingId, Number(payment.amount)) : null;

    return res.json({
      payment,
      cashfreeOrderId: payment.cashfreeOrderId,
      paymentSessionId: payment.cashfreeSessionId,
      upi: upiLink
        ? {
            pa: upiVpa,
            pn: upiName,
            am: Number(payment.amount),
            cu: 'INR',
            tn: `HomeHelp Booking ${bookingId.slice(0, 8)}`,
            link: upiLink,
          }
        : null,
    });
  } catch (err) {
    console.error('[payments] create-order error:', err);
    return res.status(500).json({ error: 'Failed to create payment' });
  }
});

paymentsRouter.post('/:id/mark-paid', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    if (payment.status === 'paid' || payment.status === 'captured') {
      return res.json({ payment });
    }

    const recomputed = computeWorkerPayout(Number(payment.amount));

    const updated = await prisma.payment.update({
      where: { id },
      data: { status: 'paid', workerPayout: recomputed },
    });

    console.log(`[Payments] Payment ${id} marked paid by admin ${req.user!.userId}`);
    return res.json({ payment: updated });
  } catch (err) {
    console.error('[payments] mark-paid error:', err);
    return res.status(500).json({ error: 'Failed to mark payment paid' });
  }
});

paymentsRouter.post('/verify', async (req, res) => {
  try {
    const { paymentId } = req.body;

    if (!paymentId) {
      return res.status(400).json({ error: 'paymentId is required' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    const isAdmin = user?.isAdmin ?? false;

    if (!isAdmin && (!payment.booking || payment.booking.userId !== req.user!.userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!cashfree || payment.paymentMethod !== 'cashfree') {
      return res.status(400).json({
        error: 'Cashfree is not configured or this is not a Cashfree payment. Use the admin mark-paid endpoint to confirm manual payments.',
      });
    }

    if (!payment.cashfreeOrderId) {
      return res.status(400).json({ error: 'No Cashfree order ID found for this payment' });
    }

    const response = await cashfree.PGOrderFetchPayments(payment.cashfreeOrderId);
    const paymentsList = response.data;
    
    const successfulPayment = paymentsList?.find((p: any) => p.payment_status === 'SUCCESS');

    if (successfulPayment) {
      if (payment.status === 'pending') {
        const recomputed = computeWorkerPayout(Number(payment.amount));
        const updatedPayment = await prisma.payment.update({
          where: { id: paymentId },
          data: {
            status: 'paid',
            workerPayout: recomputed,
          },
        });
        return res.json({ payment: updatedPayment });
      } else {
        return res.json({ payment });
      }
    } else {
      return res.status(400).json({ error: 'Payment has not been completed successfully yet' });
    }
  } catch (err: any) {
    console.error('[payments] verify error:', err.response?.data || err);
    return res.status(500).json({ error: 'Failed to verify payment status' });
  }
});

paymentsRouter.get('/booking/:bookingId', async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.bookingId },
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    const isAdmin = user?.isAdmin ?? false;
    if (booking.userId !== req.user!.userId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const payment = await prisma.payment.findUnique({
      where: { bookingId: req.params.bookingId },
    });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    return res.json({ payment });
  } catch (err) {
    console.error('[payments] get booking payment error:', err);
    return res.status(500).json({ error: 'Failed to fetch payment' });
  }
});
