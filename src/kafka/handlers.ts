/**
 * Kafka Topic Handlers for Fulfillment Service
 * 
 * Handles order/payment events and triggers fulfillment workflows.
 */

import { logger } from "../config/logger.js";
import { producer } from "./index.js";

// Topic subscription type matching kafka-client consumer
export interface TopicSubscription {
  topicName: string;
  topicHandler: (message: Record<string, unknown>) => Promise<void>;
}

// ===========================================
// ORDER HANDLERS
// ===========================================

export const orderCreatedHandler: TopicSubscription = {
  topicName: "order.created",
  topicHandler: async (message) => {
    const { orderId, orderNumber, userId, items, shippingAddress } = message as {
      orderId?: string;
      orderNumber?: string;
      userId?: string;
      items?: Array<{ productId: string; quantity: number; sku?: string }>;
      shippingAddress?: Record<string, unknown>;
    };
    
    if (!orderId) return;

    logger.info("Processing new order for fulfillment", { 
      orderId, 
      orderNumber, 
      itemCount: items?.length,
      topic: "order.created" 
    });

    // TODO: Create fulfillment record in database
    // const fulfillment = await fulfillmentRepository.create({
    //   orderId,
    //   orderNumber,
    //   userId,
    //   items,
    //   shippingAddress,
    //   status: "PENDING",
    // });

    // Emit fulfillment created event
    // await producer.send("fulfillment.created", {
    //   fulfillmentId: fulfillment.id,
    //   orderId,
    //   orderNumber,
    //   status: "PENDING",
    // });
  },
};

export const paymentSuccessfulHandler: TopicSubscription = {
  topicName: "payment.successful",
  topicHandler: async (message) => {
    const { orderId, paymentId } = message as {
      orderId?: string;
      paymentId?: string;
    };
    
    if (!orderId) return;

    logger.info("Payment confirmed, starting fulfillment", { 
      orderId, 
      paymentId,
      topic: "payment.successful" 
    });

    // TODO: Update fulfillment status to PROCESSING
    // await fulfillmentRepository.updateByOrderId(orderId, {
    //   status: "PROCESSING",
    //   paymentConfirmedAt: new Date(),
    // });
  },
};

export const orderCancelledHandler: TopicSubscription = {
  topicName: "order.cancelled",
  topicHandler: async (message) => {
    const { orderId, reason } = message as {
      orderId?: string;
      reason?: string;
    };
    
    if (!orderId) return;

    logger.info("Order cancelled, stopping fulfillment", { 
      orderId, 
      reason,
      topic: "order.cancelled" 
    });

    // TODO: Cancel fulfillment if not yet shipped
    // const fulfillment = await fulfillmentRepository.findByOrderId(orderId);
    // if (fulfillment && fulfillment.status !== "SHIPPED") {
    //   await fulfillmentRepository.update(fulfillment.id, {
    //     status: "CANCELLED",
    //     cancelledAt: new Date(),
    //     cancellationReason: reason,
    //   });
    // }
  },
};

// ===========================================
// KAFKA EVENT PRODUCERS
// ===========================================

export async function emitFulfillmentShipped(data: {
  fulfillmentId: string;
  orderId: string;
  orderNumber: string;
  userId: string;
  email: string;
  firstName: string;
  trackingNumber: string;
  carrier: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
}): Promise<void> {
  logger.info("Emitting fulfillment.shipped event", { 
    fulfillmentId: data.fulfillmentId,
    orderId: data.orderId,
  });
  
  await producer.send("fulfillment.shipped", data);
  
  // Also emit order.shipped for email service
  await producer.send("order.shipped", data);
}

export async function emitFulfillmentDelivered(data: {
  fulfillmentId: string;
  orderId: string;
  orderNumber: string;
  userId: string;
  email: string;
  firstName: string;
  deliveredAt: string;
}): Promise<void> {
  logger.info("Emitting fulfillment.delivered event", { 
    fulfillmentId: data.fulfillmentId,
    orderId: data.orderId,
  });
  
  await producer.send("fulfillment.delivered", data);
  
  // Also emit order.delivered for email service and review requests
  await producer.send("order.delivered", data);
}

// ===========================================
// ALL HANDLERS EXPORT
// ===========================================

export const allHandlers: TopicSubscription[] = [
  orderCreatedHandler,
  paymentSuccessfulHandler,
  orderCancelledHandler,
];
